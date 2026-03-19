# Forge Full Page Dashboard App (Custom UI)

A Forge app built with Custom UI that demonstrates a dashboard-style full-page module in Jira. This app showcases interactive components, data visualization using CSS, and Jira API integration.

## What This App Does

This app displays a **dashboard** with the following features:

1. **Monthly Usage Chart**: A CSS-based bar chart showing monthly usage data for Q1 (Jan-Mar) and Q2 (Apr-Jun)
2. **Interactive Period Toggle**: Buttons to switch between Q1 and Q2 data views
3. **Usage Statistics**: Displays the current period and total usage summary
4. **User Information**: Fetches and displays the current user's information from the Jira API, including:
   - Display name
   - Email address
   - Account ID
   - Profile picture

## Key Features Demonstrated

- **Custom UI**: Uses standard web technologies (HTML, CSS, JavaScript) with React
- **State Management**: React hooks (`useState`, `useEffect`) for managing component state
- **Jira API Integration**: Uses `requestJira` from `@forge/bridge` to fetch user data
- **Interactive UI**: Period selection buttons that update the chart and statistics dynamically
- **CSS Styling**: Custom CSS for bar chart visualization and responsive layout

## Requirements

See [Set up Forge](https://developer.atlassian.com/platform/forge/set-up-forge/) for instructions to get set up.

## Quick Start

1. **Install top-level dependencies** (you will need to run this first):
   ```bash
   npm install
   ```

2. **Install dependencies inside the `static/hello-world` directory**:
   ```bash
   cd static/hello-world
   npm install
   cd ../..
   ```

3. **Build your app** (inside the `static/hello-world` directory):
   ```bash
   cd static/hello-world
   npm run build
   cd ../..
   ```

4. **Deploy your app**:
   ```bash
   forge deploy
   ```

5. **Install your app** on an Atlassian site:
   ```bash
   forge install --site <your-site> --product jira
   ```

6. **Access your app** after installation:
   
   Full-page apps are accessed via a specific URL format that includes the `routePrefix` defined in your `manifest.yml`:
   
   ```
   https://<your-site>.atlassian.net/forge-apps/a/<app-id>/r/<routePrefix>/
   ```
   
   **Example:**
   ```
   https://your-site.atlassian.net/forge-apps/a/754162e1-d68d-4194-ac98-923185c4d33e/r/custom-ui/
   ```
   
   Where:
   - `<your-site>` is your tenant site name (e.g., `your-site`)
   - `<app-id>` is your app ID (found in `manifest.yml` under `app.id` or in the Forge developer console)
   - `<routePrefix>` is the `routePrefix` value from your `manifest.yml` (in this app, it's `custom-ui`)

7. **Develop locally** (optional):
   ```bash
   forge tunnel
   ```

## Project Structure

- `static/hello-world/src/App.js` - Main React component with dashboard layout and API integration
- `static/hello-world/src/` - Custom UI source files
- `static/hello-world/build/` - Built static files (generated after `npm run build`)
- `manifest.yml` - App configuration including permissions and module definitions
- `package.json` - Top-level dependencies and scripts

## Permissions

This app requires the following scope:
- `read:jira-user` - To fetch current user information from Jira API

## Notes

- Use the `forge deploy` command when you want to persist code changes.
- Use the `forge install` command when you want to install the app on a new site.
- Once the app is installed on a site, the site picks up the new app changes you deploy without needing to rerun the install command.
- Remember to rebuild your Custom UI (`npm run build` in `static/hello-world`) before deploying if you make changes to the source files.

## Learn More

See [Jira full page module documentation](https://developer.atlassian.com/platform/forge/manifest-reference/modules/jira-full-page/) for details about building Jira full-page apps.
