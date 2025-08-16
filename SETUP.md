# Complete VS Code Setup Guide for Google Drive Video Player

## Prerequisites

### 1. Install Node.js and npm
- Download and install Node.js (v18 or later) from [nodejs.org](https://nodejs.org/)
- This automatically installs npm
- Verify installation:
  \`\`\`bash
  node --version
  npm --version
  \`\`\`

### 2. Install VS Code
- Download from [code.visualstudio.com](https://code.visualstudio.com/)
- Install and launch VS Code

## VS Code Extensions (Recommended)

Install these extensions for the best development experience:

### Essential Extensions:
1. **ES7+ React/Redux/React-Native snippets** - Provides React code snippets
2. **TypeScript Importer** - Auto imports for TypeScript
3. **Tailwind CSS IntelliSense** - Autocomplete for Tailwind classes
4. **Auto Rename Tag** - Automatically renames paired HTML/JSX tags
5. **Bracket Pair Colorizer** - Colors matching brackets
6. **GitLens** - Enhanced Git capabilities
7. **Prettier - Code formatter** - Code formatting
8. **ESLint** - JavaScript/TypeScript linting

### To install extensions:
1. Open VS Code
2. Click Extensions icon (Ctrl+Shift+X)
3. Search for each extension name
4. Click "Install"

## Project Setup

### 1. Get the Project Files
You can either:
- **Option A**: Download the ZIP from v0 (click the three dots → Download ZIP)
- **Option B**: Push to GitHub from v0 and clone it

### 2. Open Project in VS Code
\`\`\`bash
# Navigate to your project folder
cd path/to/your/project

# Open in VS Code
code .
\`\`\`

### 3. Install Dependencies
Open VS Code terminal (Ctrl+`) and run:
\`\`\`bash
npm install
\`\`\`

This will install all required packages including:
- Next.js, React, TypeScript
- Tailwind CSS and UI components
- Lucide React icons
- JSZip for file extraction

## Environment Variables Setup

### 1. Create Environment File
Create a `.env.local` file in your project root:
\`\`\`bash
# In VS Code terminal
touch .env.local
\`\`\`

### 2. Add Google Client ID
Add this line to `.env.local`:
\`\`\`
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id_here
\`\`\`

### 3. Get Google Client ID
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google Drive API:
   - Go to "APIs & Services" → "Library"
   - Search "Google Drive API" → Enable
4. Create OAuth 2.0 credentials:
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth 2.0 Client IDs"
   - Application type: "Web application"
   - Name: "Drive Video Player"
   - Authorized JavaScript origins: `http://localhost:3000`
   - Authorized redirect URIs: `http://localhost:3000`
5. Copy the Client ID and paste it in `.env.local`

## Running the Project

### 1. Start Development Server
\`\`\`bash
npm run dev
\`\`\`

### 2. Open in Browser
Navigate to: `http://localhost:3000`

### 3. Test the Application
1. Click "Sign in with Google"
2. Authorize the application
3. Select a shared folder containing videos
4. Videos should load and be playable

## VS Code Configuration

### 1. Create VS Code Settings
Create `.vscode/settings.json` in your project:
\`\`\`json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.preferences.importModuleSpecifier": "relative",
  "emmet.includeLanguages": {
    "typescript": "html",
    "typescriptreact": "html"
  }
}
\`\`\`

### 2. Create Prettier Config
Create `.prettierrc` in your project root:
\`\`\`json
{
  "semi": false,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5"
}
\`\`\`

## Troubleshooting

### Common Issues:

1. **"Missing script: 'dev'" error**
   - Make sure `package.json` has the scripts section
   - Run `npm install` again

2. **Google APIs not loading**
   - Check if `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is set correctly
   - Verify Google Cloud Console setup
   - Check browser console for CORS errors

3. **TypeScript errors**
   - Run `npm run build` to check for type errors
   - Install missing type definitions if needed

4. **Port already in use**
   - Use different port: `npm run dev -- -p 3001`
   - Or kill process using port 3000

### Useful VS Code Shortcuts:
- `Ctrl+`` - Toggle terminal
- `Ctrl+Shift+P` - Command palette
- `Ctrl+P` - Quick file open
- `F12` - Go to definition
- `Alt+Shift+F` - Format document
- `Ctrl+/` - Toggle comment

## Project Structure
\`\`\`
├── app/
│   ├── page.tsx          # Main application
│   ├── layout.tsx        # Root layout
│   └── globals.css       # Global styles
├── components/
│   └── video-player.tsx  # Video player component
├── .env.local            # Environment variables
├── package.json          # Dependencies and scripts
└── README.md            # Project documentation
\`\`\`

## Next Steps
1. Customize the UI styling in `app/globals.css`
2. Add more video formats support
3. Implement playlist features
4. Add video thumbnails
5. Deploy to Vercel for production use

Happy coding! 🚀
