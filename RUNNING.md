# How to Run the IPL Auction Simulator

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- npm (comes with Node.js)

## Setup

Install dependencies (only needed once, or after pulling new changes):

```bash
npm install
```

## Development Server

Start the local dev server with hot-reload:

```bash
npm run dev
```

The app will be available at [http://localhost:5173](http://localhost:5173)

## Build for Production

Compile TypeScript and bundle the app:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

## Running Tests

Run tests in watch mode:

```bash
npm test
```

Run tests once (CI mode):

```bash
npm run test:run
```

Run tests with the browser UI:

```bash
npm run test:ui
```

## Linting

```bash
npm run lint
```
