# Garden of Whispers

Build a polished 2-page full-stack web app called “Garden Of Secrets” with a deep, elegant dark theme, subtle animations, responsive mobile-first design, and professional typography.

PAGE 1 — MAIN
- Minimal navbar with only a centered “Garden Of Secrets” text/logo.
- On first visit for each user, show an elegant animated modal:
  Heading: “Do you want to know about the apple of discord(s)?”
  Text: “Please don't let anyone know about this web. I will provide more information about 9th if you do not tell anyone. so”
  A “I Promise” button must remain disabled for 5 seconds, then become enabled.
  No close/X button; user must choose the promise to continue.
- Store each promise in the backend with a unique anonymous locator key so the admin can see the total number of promises. The promise modal must appear only once per user/device unless the admin deletes/resets that user's promise record.
- After the promise, smoothly reveal the main content using a refined swipe-in animation.
- Main heading + content cards are completely managed from Admin.
- Cards: minimum 1, maximum 20. Each card can contain ONLY one of: image, link, heading/text, or paragraph/content. Admin can add, edit, reorder, and delete cards.
- Footer: short tagline + paragraph:
  “Please do not tell anyone about this web. No new information will be provided.”
- Do not expose unnecessary site information, metadata, or admin details publicly.

PAGE 2 — ADMIN
- Protected admin route, e.g. /admin.
- Password/passcode login for now: @1234 (make it easy to change later; never expose it in frontend code).
- Two tabs:
  1. PROMISES — show total promises, anonymous locator keys, timestamps, and allow deleting individual promise records/resetting their first-visit status.
  2. INFORMATION — fully functional CMS for the main page: edit main heading, add/edit/delete/reorder cards, and edit footer tagline/paragraph.
- Changes made in Admin must update the public page dynamically/persistently through the backend.

TECHNICAL
- Full-stack persistent backend/database.
- Secure admin authentication and protected API routes.
- Anonymous user identifiers only; do not collect unnecessary personal information.
- Validate and sanitize all admin inputs.
- Prevent duplicate promises from the same user/device.
- Smooth, subtle animations; deep black/charcoal background; restrained glass/blur effects; elegant cool typography; excellent spacing.
- No unnecessary buttons, menus, social links, or decorative clutter.
- Make every feature fully functional, not a mockup. 

(It will be a source of communication between two persons okay so in anyplace donota dd extra ordinar texts okay)

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/8776a609-4cb9-4a2e-94e2-490f92d7a769).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
