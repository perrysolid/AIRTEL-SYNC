# WhatsApp bridge

Runs the Udyam bot on a normal WhatsApp number, with no Meta Business setup. It links to the number as a linked
device (like WhatsApp Web) and answers every message through the live backend.

1. Put the SIM in a phone and install WhatsApp (or WhatsApp Business). Register the number there.
2. Run, with the number including the country code:
   ```
   npm install
   WA_NUMBER=91XXXXXXXXXX npm start
   ```
3. On the phone, open WhatsApp → Settings → Linked devices → Link a device → "Link with phone number instead", and type
   the 8-character code the bridge printed.
4. Leave it running. Anyone who messages the number gets the bot. Later runs are just `npm start` (the login is saved in `auth/`).

`BACKEND_URL` points it at another backend (default `https://airtel-sync.onrender.com`).

Unofficial client: fine for the demo, but WhatsApp can restrict numbers that run bots. Use a spare number.
