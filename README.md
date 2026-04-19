# IGY (I Got You) - Community Support App

A community-based mutual aid platform for singles and solo dwellers in Seattle.

## Current Features

✅ User authentication (test accounts: Sonya & Jane)
✅ Community Feed & My Activity tabs
✅ Create and post requests for help
✅ Accept requests with confirmation modal
✅ Dual-confirmation "Mark as Complete" system
✅ Cancel commitment flow with friction
✅ Contact info exchange on acceptance
✅ Completed requests tracking
✅ Persistent data with localStorage

## Setup Instructions

### Option 1: Continue in Claude Code

1. **Open your terminal** and navigate to where you want the project:
   ```bash
   cd ~/Projects  # or wherever you keep projects
   ```

2. **Download all files** from this conversation to a folder called `igy-app`

3. **Install dependencies:**
   ```bash
   cd igy-app
   npm install
   ```

4. **Add Tailwind CSS** (required for styling):
   ```bash
   npm install -D tailwindcss postcss autoprefixer
   npx tailwindcss init -p
   ```

5. **Update `tailwind.config.js`:**
   ```js
   export default {
     content: [
       "./index.html",
       "./src/**/*.{js,ts,jsx,tsx}",
     ],
     theme: {
       extend: {},
     },
     plugins: [],
   }
   ```

6. **Run the development server:**
   ```bash
   npm run dev
   ```

7. **Open in Claude Code:**
   ```bash
   claude-code .
   ```

   Then tell Claude: "Help me fix the completion confirmation bug where helperConfirmed flags aren't syncing between users"

### Option 2: Continue in Cowork

Cowork is better for non-developers or file management tasks.

1. **Download all the files** from the outputs folder
2. **Open Cowork** 
3. **Upload the entire `igy-app` folder**
4. Tell Cowork: "Help me organize these React files into a proper project structure and fix the completion confirmation bug"

## Known Issues to Fix

🐛 **Completion Confirmation Bug**: When Sonya marks a request as complete, Jane doesn't see the `helperConfirmed` flag properly. This is a state synchronization issue between localStorage and React state when switching users.

**Root Cause**: The confirmation flags (`helperConfirmed`, `requesterConfirmed`) are being set in one user's session but not persisting correctly when the other user logs in fresh.

**Next Steps**:
1. Add real-time sync or force localStorage reload when user logs in
2. Or use a shared backend (Firebase/Supabase) instead of localStorage
3. Debug panel shows the flags - use it to verify what's actually in the request object

## File Structure

```
igy-app/
├── index.html          # Entry HTML
├── package.json        # Dependencies
├── vite.config.js      # Vite configuration
├── tailwind.config.js  # Tailwind config (create this)
├── postcss.config.js   # PostCSS config (auto-created)
└── src/
    ├── main.jsx        # React entry point
    ├── App.jsx         # Main app component (1500+ lines)
    └── index.css       # Tailwind imports
```

## Next Features to Implement

Based on the PRD gap analysis:

1. **Fix completion confirmation bug** (HIGH PRIORITY)
2. **Functional rating system** after completion
3. **Reciprocity enforcement** - block posting when ratio exceeded
4. **Community Gives** - post jokes/recipes to earn "gives"
5. **Edit/Cancel my requests**
6. **Report & Block functionality**

## Tech Stack

- **React 18** - UI framework
- **Vite** - Build tool & dev server
- **Tailwind CSS** - Styling (required!)
- **Lucide React** - Icons
- **localStorage** - Data persistence (temporary, should migrate to backend)

## Development Notes

- Currently using localStorage for all data - this is prototype-only
- User switching simulates multiple users but doesn't sync in real-time
- Need to migrate to Firebase/Supabase for production
- All state management is in App.jsx (should refactor to Context/Redux)

## Questions?

Continue the conversation in Claude Code or Cowork and reference this README!
