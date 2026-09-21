# Route / API Matrix

| Frontend route | Main API |
|---|---|
| `/login` | `POST /auth/login` |
| `/register` | `POST /auth/register` |
| `/trips` | `GET /trips`, `GET /trips/{id}/summary` |
| `/trips/new` | `POST /trips` |
| `/trips/[id]` | `GET /trips/{id}`, `GET /trips/{id}/summary`, `POST /trips/{id}/archive`, `POST /trips/{id}/unarchive` |
| `/trips/[id]/map` | place search / add place / custom place / itinerary / checkins / timeline |
| `/trips/[id]/gallery` | photo presign / register / feature / delete |
| `/trips/[id]/achievements` | `GET /trips/{id}/achievements` |
| `/trips/[id]/summary` | summary / complete |
| `/trips/[id]/share` | share-links / photos / timeline / html-to-image |
| `/trips/[id]/video` | video-projects / render / progress |
| `/explore/tokyo` | official city places / add official place |
| `/pricing` | Stripe checkout / latest payment |
| `/profile` | `GET/PUT /users/me` |
| `/s/[token]` | `GET /share/{token}` |
