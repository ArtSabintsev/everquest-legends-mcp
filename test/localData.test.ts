import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { inspectVmwareFusion, parseVmwareKeyValue, scanLocalFiles } from "../src/localData.js";

describe("local data helpers", () => {
  it("parses VMware key/value config files", () => {
    const config = parseVmwareKeyValue(`
displayName = "Windows 11 ARM Gaming"
memsize = "24576"
sharedFolder0.hostPath = "/Users/me/Downloads"
# ignored = "yes"
`);

    expect(config.displayName).toBe("Windows 11 ARM Gaming");
    expect(config.memsize).toBe("24576");
    expect(config["sharedFolder0.hostPath"]).toBe("/Users/me/Downloads");
    expect(config.ignored).toBeUndefined();
  });

  it("summarizes a VMware Fusion bundle without leaking raw config", async () => {
    const temp = await mkdtemp(path.join(os.tmpdir(), "eql-vmware-"));
    const bundle = path.join(temp, "Windows 11 64-bit Arm.vmwarevm");
    await mkdir(bundle);
    await mkdir(path.join(bundle, "Game Disk.vmdk.lck"));
    await writeFile(
      path.join(bundle, "Windows 11 64-bit Arm.vmx"),
      `
displayName = "Windows 11 ARM Gaming"
guestOS = "arm-windows11-64"
numvcpus = "8"
memsize = "24576"
mks.enable3d = "TRUE"
nvme0:0.fileName = "Game Disk.vmdk"
nvme0:0.present = "TRUE"
sharedFolder0.enabled = "TRUE"
sharedFolder0.hostPath = "/Users/me/Downloads"
sharedFolder0.guestName = "Mac Downloads"
encryption.keySafe = "do-not-return"
`
    );
    await writeFile(
      path.join(bundle, "Game Disk.vmdk"),
      `
# Disk DescriptorFile
createType="twoGbMaxExtentSparse"
RW 2048 SPARSE "Game Disk-s001.vmdk"
ddb.adapterType = "lsilogic"
ddb.uuid = "60 00 C2 test"
`
    );
    await writeFile(path.join(bundle, "Game Disk-s001.vmdk"), "extent");
    await writeFile(path.join(bundle, "vmware.log"), "Guest: DXUM_09: Unrecognized shader, use fallback path.\n");

    const inventory = await inspectVmwareFusion({
      roots: [temp],
      includeVmwareInventory: false,
      includeLogSignals: true,
      includeDiskExtents: true
    });

    expect(inventory.vms).toHaveLength(1);
    expect(inventory.vms[0]?.displayName).toBe("Windows 11 ARM Gaming");
    expect(inventory.vms[0]?.hardware.memoryMiB).toBe(24576);
    expect(inventory.vms[0]?.sharedFolders[0]?.guestName).toBe("Mac Downloads");
    expect(inventory.vms[0]?.disks[0]?.locked).toBe(true);
    expect(inventory.vms[0]?.disks[0]?.virtualSizeBytes).toBe(2048 * 512);
    expect(JSON.stringify(inventory)).not.toContain("do-not-return");
  });

  it("scans allowed local text files for EQL metadata", async () => {
    const temp = await mkdtemp(path.join(os.tmpdir(), "eql-scan-"));
    await mkdir(path.join(temp, "logs"));
    await writeFile(path.join(temp, "logs", "LaunchPad.log"), "EverQuest Legends patch manifest from Daybreak.");
    await writeFile(path.join(temp, "logs", "other.txt"), "No relevant content.");

    const scan = await scanLocalFiles({
      rootPath: temp,
      allowedRoots: [temp],
      query: "EverQuest Legends Daybreak LaunchPad",
      maxFiles: 10
    });

    expect(scan.matches.map((match) => match.relativePath)).toEqual(["logs/LaunchPad.log"]);
    expect(scan.matches[0]?.matchedTerms).toContain("EverQuest");
    expect(scan.matches[0]?.snippets[0]).toContain("patch manifest");
  });
});
