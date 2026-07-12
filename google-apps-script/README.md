# Form backend (Google Apps Script)

The newsletter and contact forms POST to a Google Apps Script web app, which appends
each submission to a Google Sheet.
`Code.gs` is kept here so it is reviewable and version
controlled. Apps Script has no import mechanism, so it has to be pasted into the
Apps Script editor by hand.

## Setup

1. Create a spreadsheet, e.g. **YouthPRG submissions**, with two tabs:

   | Tab          | Header row                                              |
   | ------------ | ------------------------------------------------------- |
   | `Newsletter` | `Timestamp`, `Email`, `Page`                            |
   | `Contact`    | `Timestamp`, `Name`, `Email`, `Subject`, `Message`, `Page` |

2. In that spreadsheet: **Extensions → Apps Script →** paste in the contents of `Code.gs` from this folder. Save.

3. **Deploy → New deployment → Web app**:

   - Description: `YouthPRG forms`
   - Execute as: **Me**
   - Who has access: **Anyone** — *not* "Anyone with a Google account", which would
     bounce visitors to a Google login page.

   Authorize when prompted (the "unverified app" warning is expected for your own
   script — click Advanced → Go to project).

4. Copy the **Web app URL** ending in `/exec` and paste it into `APPS_SCRIPT_URL`
   at the top of [`../js/forms.js`](../js/forms.js).

## Changing the script later

Edit in the Apps Script editor, then **Manage deployments → (pencil) → Version:
New version → Deploy**. This keeps the `/exec` URL stable. Creating a *new
deployment* instead mints a new URL and silently breaks the site. Mirror any change
back into `Code.gs` here.

## The spreadsheet

The sheet stays private ("Private, only you"); the script runs as its owner and
writes on their behalf. "Who has access: Anyone" applies to the *script endpoint*,
not the sheet — it means anyone may invoke the code, not that anyone may see the data.

The endpoint is **append-only**: `doPost` writes a row and returns `{ok:true}`;
`doGet` is a dataless health check. Nothing reads from or returns sheet contents, so
the worst someone who finds the URL can do is write junk rows — they cannot read,
edit, or delete the subscriber list. **Preserve that invariant when editing `Code.gs`.**

Spam defence is the `_gotcha` honeypot plus server-side email validation. If that would not be enough, add Cloudflare Turnstile — a per-IP limit in the script would not work, since it only ever sees Google's proxy.
