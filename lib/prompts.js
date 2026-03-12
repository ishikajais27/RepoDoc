export function buildUserDocPrompt(repoData) {
  return `You are a technical writer creating beginner-friendly documentation.

Repository: ${repoData.owner}/${repoData.repo}
Description: ${repoData.description || 'No description provided'}
Main Language: ${repoData.language}
Languages Used: ${Object.keys(repoData.languages).join(', ')}
Topics: ${repoData.topics.join(', ')}
Deployed URL: ${repoData.homepage || 'None'}
Files in root: ${repoData.allFiles.join(', ')}

File contents:
${Object.entries(repoData.fileContents)
  .map(
    ([name, content]) =>
      `### ${name}\n\`\`\`\n${content.slice(0, 2000)}\n\`\`\``,
  )
  .join('\n\n')}

Write a USER documentation in markdown. Rules:
- Super simple, dumb-proof language. Imagine explaining to a non-developer.
- Include: What is this project (1 paragraph), Features list, How to install (step by step numbered), How to use it (with examples), FAQ (3-5 common questions)
- If homepage exists (${repoData.homepage}), add a "🚀 Live Demo" section at the top with the link
- If no homepage, add a note that they can run it locally
- Use emojis to make it friendly
- NO jargon. If you must use a technical term, explain it in parentheses
- Format as clean markdown
- Add a screenshots section placeholder: ![Screenshot](screenshot.png) with note "Replace with actual screenshots"`
}

export function buildDevDocPrompt(repoData) {
  return `You are a senior software engineer writing technical documentation for a portfolio/job application.

Repository: ${repoData.owner}/${repoData.repo}
Description: ${repoData.description || 'No description'}
Languages: ${JSON.stringify(repoData.languages)}
Topics: ${repoData.topics.join(', ')}
Deployed URL: ${repoData.homepage || 'None'}
Files: ${repoData.allFiles.join(', ')}

File contents:
${Object.entries(repoData.fileContents)
  .map(
    ([name, content]) =>
      `### ${name}\n\`\`\`\n${content.slice(0, 2000)}\n\`\`\``,
  )
  .join('\n\n')}

Write a TECHNICAL/DEVELOPER documentation in markdown. Rules:
- Target audience: hiring managers, senior devs, technical interviewers
- Include:
  1. **Project Overview** - What problem it solves, why it matters
  2. **Tech Stack** - Every technology with WHY it was chosen
  3. **Architecture** - How it's structured, design decisions, patterns used
  4. **Key Technical Decisions** - Tradeoffs made, alternatives considered
  5. **API Reference** (if applicable) - Endpoints, params, responses
  6. **Database Schema** (if applicable)
  7. **Performance Considerations** - Any optimizations done
  8. **Security** - Auth, data validation, etc.
  9. **Testing** - Testing strategy used
  10. **Future Improvements** - What you'd do with more time
- If homepage exists, add deployed link prominently
- Use proper markdown with code blocks
- Be specific about implementation details - this is for technical credibility`
}

export function buildReadmePrompt(repoData) {
  return `You are creating a professional GitHub README.md that will impress both users and employers.

Repository: ${repoData.owner}/${repoData.repo}
Description: ${repoData.description || 'No description'}
Languages: ${JSON.stringify(repoData.languages)}
Topics: ${repoData.topics.join(', ')}
Deployed URL: ${repoData.homepage || 'None'}
Stars: ${repoData.stars}
Owner: ${repoData.owner}

File contents:
${Object.entries(repoData.fileContents)
  .map(
    ([name, content]) =>
      `### ${name}\n\`\`\`\n${content.slice(0, 1500)}\n\`\`\``,
  )
  .join('\n\n')}

Write a stunning README.md. Rules:
- Start with badges: ![GitHub stars](https://img.shields.io/github/stars/${repoData.owner}/${repoData.repo}) ![GitHub last commit](https://img.shields.io/github/last-commit/${repoData.owner}/${repoData.repo})
- If deployed (${repoData.homepage}): Add a live demo badge and prominent demo section
- If NOT deployed: Add website screenshot section with this exact markdown:
  ## 📸 Screenshots
  ![Home Page](screenshots/home.png)
  ![Feature Screenshot](screenshots/feature.png)
  And a note: "To add screenshots: create a screenshots/ folder and add your images"
- Sections: Project title with emoji, short tagline, badges row, demo/screenshots, about, features (with emojis), tech stack, installation, usage, contributing, license
- Make the title and tagline catchy and memorable
- Use tables for tech stack
- Format: clean, scannable, impressive`
}
