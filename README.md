# Course Import Frontend (Vue 3)

This is the frontend application for the Course Import system, built with Vue 3 and Vuetify.

## Project Setup

1. Install dependencies:

```
npm install
```

2. Create a `.env` file in the root directory with:

```
VITE_APP_CLIENT_ID=your-google-client-id
```

3. Run the development server:

```
npm run dev
```

The application will be available at `http://localhost:8081`

## Features

### Faculty Users
- Google authentication
- View courses by term
- Assign import courses from other terms

### Admin Users
- Admin dashboard with statistics
- Manage terms (add, update, delete)
- Manage users (view, update admin status)
- View courses with assignment counts

## Build for Production

```
npm run build
```

