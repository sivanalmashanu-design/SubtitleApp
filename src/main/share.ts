import { spawn } from 'node:child_process'
import { shell } from 'electron'

// JXA that pops the macOS share sheet (AirDrop, Messages, Mail, WhatsApp, …).
// Key detail: DON'T quit the helper the instant a service is chosen — that kills
// AirDrop/Mail mid-handoff ("nothing happens"). Instead attach a service
// delegate and quit only once the share actually finishes / fails / is cancelled.
const SHARE_JXA = `
ObjC.import('AppKit');
ObjC.import('Foundation');
function run(argv) {
  function done() { $.NSApp.terminate(null); }

  const url = $.NSURL.fileURLWithPath(argv[0]);
  const items = $.NSArray.arrayWithObject(url);
  const app = $.NSApplication.sharedApplication;
  app.setActivationPolicy($.NSApplicationActivationPolicyAccessory);

  if (!$.ASShareSvcDelegate) {
    ObjC.registerSubclass({
      name: 'ASShareSvcDelegate',
      superclass: 'NSObject',
      protocols: ['NSSharingServiceDelegate'],
      methods: {
        // quit as soon as the share finishes, is cancelled, or fails
        'sharingService:didShareItems:': { types: ['void', ['id', 'id']], implementation: done },
        'sharingService:didFailToShareItems:error:': { types: ['void', ['id', 'id', 'id']], implementation: done }
      }
    });
    ObjC.registerSubclass({
      name: 'ASSharePickerDelegate',
      superclass: 'NSObject',
      protocols: ['NSSharingServicePickerDelegate'],
      methods: {
        'sharingServicePicker:didChooseSharingService:': {
          types: ['void', ['id', 'id']],
          implementation: function (picker, service) {
            if (!service) { done(); return; }             // picker dismissed, nothing chosen
            service.delegate = $.svcDel;
          }
        }
      }
    });
  }

  // strong refs so the delegates aren't collected while the panel is open
  $.svcDel = $.ASShareSvcDelegate.alloc.init;
  const pickDel = $.ASSharePickerDelegate.alloc.init;

  const picker = $.NSSharingServicePicker.alloc.initWithItems(items);
  picker.delegate = pickDel;

  const win = $.NSWindow.alloc.initWithContentRectStyleMaskBackingDefer(
    $.NSMakeRect(0, 0, 300, 40), $.NSWindowStyleMaskBorderless, $.NSBackingStoreBuffered, false);
  win.alphaValue = 0;
  win.center;
  win.makeKeyAndOrderFront(null);
  app.activateIgnoringOtherApps(true);
  picker.showRelativeToRectOfViewPreferredEdge(win.contentView.bounds, win.contentView, 1);

  // Hard backstop: AirDrop (and sometimes Mail) don't call any delegate method
  // when you cancel their sheet, so the helper would otherwise sit forever.
  // Add the timer in the common run-loop modes so it still fires while a modal
  // AirDrop panel is up (a plain scheduledTimer is stuck in default mode).
  const killer = $.NSTimer.timerWithTimeIntervalTargetSelectorUserInfoRepeats(
    25, $.NSApp, 'terminate:', null, false);
  $.NSRunLoop.currentRunLoop.addTimerForMode(killer, $.NSRunLoopCommonModes);

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
    // Don't make the renderer wait on the share sheet: the picker is its own
    // window, and cancelling AirDrop never notifies us. Resolve once the sheet
    // has had time to appear so the Export dialog's buttons free up again.
    const settle = setTimeout(() => finish({ ok: true }), 1200)
    // Separate leak-guard for the helper process (not tied to the promise).
    const guard = setTimeout(() => child.kill('SIGKILL'), 90_000)
    child.on('error', () => {
      clearTimeout(settle)
      clearTimeout(guard)
      shell.showItemInFolder(filePath)
      finish({ ok: false, note: 'Could not open the share sheet — file revealed instead.' })
    })
    child.on('close', () => {
      clearTimeout(settle)
      clearTimeout(guard)
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
