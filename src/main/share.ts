import { spawn } from 'node:child_process'
import { shell } from 'electron'

// JXA that pops the macOS share sheet (AirDrop, Messages, Mail, WhatsApp, …)
// for a single file, then quits once the user picks a service or dismisses it.
const SHARE_JXA = `
ObjC.import('AppKit');
ObjC.import('Foundation');
function run(argv) {
  const url = $.NSURL.fileURLWithPath(argv[0]);
  const items = $.NSArray.arrayWithObject(url);
  const app = $.NSApplication.sharedApplication;
  app.setActivationPolicy($.NSApplicationActivationPolicyRegular);
  const picker = $.NSSharingServicePicker.alloc.initWithItems(items);
  if (!$.ShareDelegate) {
    ObjC.registerSubclass({
      name: 'ShareDelegate',
      superclass: 'NSObject',
      protocols: ['NSSharingServicePickerDelegate'],
      methods: {
        'sharingServicePicker:didChooseSharingService:': {
          types: ['void', ['id', 'id']],
          implementation: function () { $.NSApp.terminate(null); }
        }
      }
    });
  }
  const del = $.ShareDelegate.alloc.init;
  picker.delegate = del;
  const win = $.NSWindow.alloc.initWithContentRectStyleMaskBackingDefer(
    $.NSMakeRect(0, 0, 440, 90), $.NSWindowStyleMaskTitled, $.NSBackingStoreBuffered, false);
  win.title = 'Share captioned video';
  win.center;
  win.makeKeyAndOrderFront(null);
  app.activateIgnoringOtherApps(true);
  const v = win.contentView;
  picker.showRelativeToRectOfViewPreferredEdge(v.bounds, v, 1);
  app.run;
}
`

export interface ShareResult {
  ok: boolean
  note?: string
}

/** Open the OS share sheet for `filePath`. macOS shows the native picker;
 *  other platforms fall back to revealing the file. */
export function shareFile(filePath: string): Promise<ShareResult> {
  if (process.platform !== 'darwin') {
    shell.showItemInFolder(filePath)
    return Promise.resolve({
      ok: false,
      note: 'System sharing is macOS-only for now — the file is highlighted in your file manager.',
    })
  }
  return new Promise((resolve) => {
    let done = false
    const finish = (r: ShareResult): void => {
      if (done) return
      done = true
      resolve(r)
    }
    const child = spawn('osascript', ['-l', 'JavaScript', '-e', SHARE_JXA, filePath], {
      stdio: 'ignore',
    })
    const t = setTimeout(() => {
      child.kill('SIGTERM')
      finish({ ok: true })
    }, 120_000)
    child.on('error', () => {
      clearTimeout(t)
      shell.showItemInFolder(filePath)
      finish({ ok: false, note: 'Could not open the share sheet — file revealed instead.' })
    })
    child.on('close', () => {
      clearTimeout(t)
      finish({ ok: true })
    })
  })
}

/** Start a new email with the file attached (macOS Mail); elsewhere open the
 *  default mail client and reveal the file to attach manually. */
export async function emailFile(filePath: string): Promise<void> {
  if (process.platform === 'darwin') {
    spawn('open', ['-a', 'Mail', filePath], { stdio: 'ignore' })
    return
  }
  await shell.openExternal('mailto:?subject=Captioned%20video')
  shell.showItemInFolder(filePath)
}
