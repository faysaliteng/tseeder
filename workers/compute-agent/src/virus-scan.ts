/**
 * ClamAV virus scanner integration.
 * Scans downloaded files using the `clamscan` CLI tool.
 *
 * Prerequisites on the VM:
 *   sudo apt install -y clamav clamav-daemon
 *   sudo systemctl enable clamav-freshclam
 *   sudo freshclam
 */

import { execFile } from "node:child_process";
import { logger } from "./logger";

export interface ScanResult {
  /** "clean" | "infected" | "error" */
  status: "clean" | "infected" | "error";
  /** Threat name if infected, error message if error, null if clean */
  detail: string | null;
  /** Scan duration in milliseconds */
  durationMs: number;
  /** Number of files scanned */
  filesScanned: number;
  /** Number of infected files found */
  infectedCount: number;
}

/**
 * Scan a directory with clamscan (no daemon needed).
 * Times out after 5 minutes for large downloads.
 */
export async function scanDirectory(dirPath: string): Promise<ScanResult> {
  const startTime = Date.now();

  return new Promise((resolve) => {
    // clamscan flags:
    //   -r  = recursive
    //   --no-summary is NOT used so we can parse summary
    //   --stdout = output to stdout
    //   Exit codes: 0=clean, 1=infected, 2=error
    const proc = execFile(
      "clamscan",
      ["-r", "--stdout", dirPath],
      { timeout: 5 * 60 * 1000, maxBuffer: 10 * 1024 * 1024 },
      (error, stdout, stderr) => {
        const durationMs = Date.now() - startTime;

        // Parse summary from stdout
        const filesMatch = stdout.match(/Scanned files:\s*(\d+)/);
        const infectedMatch = stdout.match(/Infected files:\s*(\d+)/);
        const filesScanned = filesMatch ? parseInt(filesMatch[1]) : 0;
        const infectedCount = infectedMatch ? parseInt(infectedMatch[1]) : 0;

        if (error && (error as any).code === "ENOENT") {
          logger.warn("clamscan not found — skipping virus scan");
          resolve({
            status: "error",
            detail: "ClamAV not installed (clamscan not found)",
            durationMs,
            filesScanned: 0,
            infectedCount: 0,
          });
          return;
        }

        // Exit code 1 = infected found
        if (error && (error as any).code === 1) {
          // Extract threat names from output
          const threats = stdout
            .split("\n")
            .filter((line) => line.includes("FOUND"))
            .map((line) => line.replace(/:\s*/, ": ").trim())
            .join("; ");

          logger.warn({ dirPath, threats, filesScanned, infectedCount }, "Virus detected!");
          resolve({
            status: "infected",
            detail: threats || "Malware detected",
            durationMs,
            filesScanned,
            infectedCount,
          });
          return;
        }

        // Exit code 2 = error
        if (error && (error as any).code === 2) {
          logger.error({ dirPath, stderr }, "ClamAV scan error");
          resolve({
            status: "error",
            detail: stderr?.trim() || "ClamAV scan error",
            durationMs,
            filesScanned,
            infectedCount: 0,
          });
          return;
        }

        // Exit code 0 = clean
        logger.info({ dirPath, filesScanned, durationMs }, "Virus scan clean");
        resolve({
          status: "clean",
          detail: null,
          durationMs,
          filesScanned,
          infectedCount: 0,
        });
      },
    );
  });
}
