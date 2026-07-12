// Sends the newsletter and contact forms to the Google Apps Script web app, which
// appends each submission to our spreadsheet. See google-apps-script/README.md for
// the deployment steps and why this URL is safe to publish.
const APPS_SCRIPT_URL =
    'https://script.google.com/macros/s/AKfycbxqGjK2umEeJZ3CBIlhm-BdMd5zHwV4Fj3rcXgzfsi18qLfSofF5e_-o1iTYe1Nq7HL/exec';

const CONTACT_EMAIL = 'info@youthprg.com';

// The newsletter form sits on the dark footer, the contact form on a light card, so
// each needs its own status colours.
const TONES = {
    dark: { error: 'text-red-300', accent: 'text-green-300' },
    light: { error: 'text-red-600', accent: 'text-green-600' }
};

function toneFor(form) {
    return TONES[form.dataset.formTheme] || TONES.light;
}

function showError(form, message) {
    const status = form.querySelector('[data-form-status]');
    if (!status) return;
    status.textContent = message;
    status.className = `mt-3 text-sm ${toneFor(form).error}`;
}

// x-www-form-urlencoded keeps this a CORS "simple request". A JSON content type would
// trigger a preflight, which Apps Script cannot answer.
function sendToSheet(form, formType) {
    const body = new URLSearchParams(new FormData(form));
    body.set('formType', formType);
    body.set('page', location.pathname);

    return fetch(APPS_SCRIPT_URL, { method: 'POST', body }).then((response) => {
        if (!response.ok) throw new Error('sheet request failed: ' + response.status);
        return response.json();
    });
}

function sendToFormspree(form) {
    return fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { Accept: 'application/json' }
    }).then((response) => {
        if (!response.ok) throw new Error('formspree request failed: ' + response.status);
    });
}

function handleSubmit(form, formType, renderSuccess) {
    form.addEventListener('submit', (event) => {
        event.preventDefault();

        const email = form.querySelector('[name="email"]').value.trim();
        const button = form.querySelector('button[type="submit"]');
        const idleButton = button.innerHTML;

        button.disabled = true;
        button.classList.add('opacity-60', 'cursor-not-allowed');
        button.innerHTML = button.dataset.busyLabel || '<i class="fas fa-spinner fa-spin"></i>';
        showError(form, '');

        // The sheet is the durable record, so only it decides success. Formspree is a
        // best-effort email notification: it rejects posts from any origin other than
        // the live domain, and its free tier stops accepting at 50/month. Neither may
        // tell a visitor their message was lost when the row was in fact saved.
        const sheetWrite = sendToSheet(form, formType);
        const notify = formType === 'contact' ? sendToFormspree(form) : Promise.resolve();

        Promise.allSettled([sheetWrite, notify])
            .then(([sheet, email_]) => {
                if (email_.status === 'rejected') {
                    console.warn('Formspree notification failed; row was still saved.', email_.reason);
                }
                if (sheet.status === 'rejected') throw sheet.reason;
                if (sheet.value && sheet.value.ok === false) throw new Error(sheet.value.error);

                // Replace the whole form so the success state is unmissable and an
                // impatient click can't submit the same address twice.
                form.replaceWith(renderSuccess(email));
            })
            .catch((error) => {
                console.error(error);
                showError(form, `Something went wrong. Please email us at ${CONTACT_EMAIL}.`);
                button.disabled = false;
                button.classList.remove('opacity-60', 'cursor-not-allowed');
                button.innerHTML = idleButton;
            });
    });
}

function newsletterSuccess() {
    const panel = document.createElement('p');
    panel.className = 'max-w-md mx-auto text-center text-green-300';
    panel.setAttribute('role', 'status');
    panel.innerHTML = '<i class="fas fa-check-circle mr-2"></i>Thanks — you are on the list!';
    return panel;
}

function contactSuccess(email) {
    const panel = document.createElement('div');
    panel.className = 'text-center py-8';
    panel.setAttribute('role', 'status');

    const icon = document.createElement('div');
    icon.className =
        'w-16 h-16 mx-auto mb-5 rounded-full bg-green-100 flex items-center justify-center';
    icon.innerHTML = '<i class="fas fa-check text-2xl text-green-600"></i>';

    const heading = document.createElement('h3');
    heading.className = 'text-2xl font-bold mb-2';
    heading.textContent = 'Message sent!';

    const body = document.createElement('p');
    body.className = 'text-gray-600';
    // textContent, not innerHTML: the address is user input.
    body.textContent = `Thanks for writing. We'll reply to ${email} as soon as we can.`;

    panel.append(icon, heading, body);
    return panel;
}

document.querySelectorAll('[data-newsletter-form]').forEach((form) => {
    handleSubmit(form, 'newsletter', newsletterSuccess);
});

const contactForm = document.querySelector('[data-contact-form]');
if (contactForm) {
    handleSubmit(contactForm, 'contact', contactSuccess);
}
