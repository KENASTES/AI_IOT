# Food Match — Backend handoff

## Frontend stack

- React 19 + Next/Vinext
- TypeScript
- Tailwind CSS 4
- Lucide icons

## Current demo persistence

The personal dashboard saves one JSON object to browser local storage:

```
food-match-profile-v2
```

Fields:

```ts
type Profile = {
  name: string
  age: string
  height: string
  weight: string
  allergies: string
  conditions: string
  dislikes: string
  monthlyBudget: number
  dailyBudget: number
}
```

Replace this adapter with authenticated API calls when the backend is ready.

## Suggested API surface

- `GET /api/profile`
- `PUT /api/profile`
- `POST /api/matches/eat` — context: budget, time, hunger, mood, goal
- `POST /api/matches/cook` — ingredients, available time, equipment
- `GET /api/food-memory`
- `POST /api/food-memory`
- `GET /api/budget`
- `POST /api/budget/transactions`

All match endpoints should apply allergy and health restriction rules before AI ranking.

## Demo routes

The current prototype is a client-side single-page flow with four top-level screens:

1. Home
2. กินไรดี
3. ทำเมนูไรกินดี
4. Food Memory

The profile icon opens a persistent personal dashboard from every screen.
