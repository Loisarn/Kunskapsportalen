# Architecture

## Overview

Kunskapsportalen is an offline-first Progressive Web App. Learning content is organized as content packages and concepts; child profiles, sessions, and learning progress are stored locally.

## Application Structure

```text
src/
  app/
    AppRoot.tsx                 App initialization and selected-profile state
    providers/AppContext.ts     Shared app context contract
    router/
      AppLayout.tsx             Shared navigation shell
      AppRoutes.tsx             Route declarations and page composition
  features/
    play-session/               Play-specific presentation helpers
    profile-selection/          Profile creation, placement, and selection
  pages/                        Route-level page components
  services/                     Application and domain workflows
  domain/                       Shared domain types
  content/                      Static learning content packages
  data/database.ts              Dexie database and schema versions
```

`AppRoot` initializes content and profiles, selects the active profile, and supplies profile operations to the router. Pages own their route-level UI and call the existing services. Feature modules own UI and helpers specific to a workflow. The layout owns shared navigation and renders the active route through an outlet.

## Architecture Principles

- **Offline first:** the application works without a backend or network connection after its content is available locally.
- **Content driven:** learning material is delivered as content packages.
- **Concept driven:** concepts connect lessons, questions, discoveries, and child progress.
- **Local persistence:** version 1 stores user data in IndexedDB through Dexie.
- **Incremental boundaries:** pages and features depend on existing domain types and services; moving a component must not change its behavior or its persisted data.

## Data Flow

```text
Content package
  -> Concept, lesson, questions, and discoveries
  -> Child session and progress
  -> Progress and achievement summaries
```

## Persistence

Static content is under `src/content/`. The Dexie database and its schema migrations remain in `src/data/database.ts`; services remain in `src/services/`. This structure does not yet include repository abstractions or a separate database module. User data includes profiles, progress, learning paths, sessions, challenges, achievements, and parent settings.

## Technology

- React and TypeScript
- Vite and React Router
- Dexie with IndexedDB
- vite-plugin-pwa

## Future Extensions

Cloud sync, account export/import, family sharing, and a content marketplace are outside version 1 and must not be required for the offline application to work.