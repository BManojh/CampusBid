# CampusBid API

The backend is the source of truth for authentication, listing state, bids, auction
deadlines, seller decisions and handovers. Monetary request values are decimal rupees;
the server validates and stores them as integer paise.

## Public endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Health check |
| POST | `/api/auth/register` | Register a buyer or seller |
| POST | `/api/auth/login` | Login and receive a short-lived JWT |
| GET | `/api/listings` | Search, filter, sort and paginate open listings |
| GET | `/api/listings/:listingId` | View a listing |

## Authenticated endpoints

Send `Authorization: Bearer <token>`.

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/api/auth/me` | Any user | Current user |
| POST | `/api/auth/logout` | Any user | Client session sign-out acknowledgement |
| GET | `/api/dashboard` | Any user | Authorized dashboard activity |
| GET/PATCH | `/api/users/me` | Any user | View/update own profile |
| GET | `/api/notifications` | Any user | Private notifications |
| PATCH | `/api/notifications/:id/read` | Any user | Mark one notification read |
| PATCH | `/api/notifications/read-all` | Any user | Mark all notifications read |
| POST | `/api/listings` | Seller/admin | Create a listing |
| GET | `/api/listings/mine` | Seller/admin | Own listings |
| PATCH | `/api/listings/:id` | Listing owner/admin | Edit before bidding starts |
| DELETE | `/api/listings/:id` | Listing owner/admin | Cancel without bids |
| POST | `/api/listings/:id/bids` | Buyer | Place a manual bid |
| GET | `/api/listings/:id/bids` | Seller/admin | View bid history |
| GET | `/api/transactions/mine` | Buyer/seller | Own transactions |
| PATCH | `/api/transactions/:id/decision` | Seller | Accept/reject winning bid |
| PATCH | `/api/transactions/:id/handover` | Buyer/seller | Confirm handover |

`POST /api/listings/:id/bids` supports an `Idempotency-Key` header. The server
rechecks the auction deadline and minimum bid inside a database transaction, and
the seller cannot bid on their own listing. Equal winning bids are resolved by
the earliest accepted bid.

The auction worker runs on the backend every 30 seconds and also runs once at
startup, so overdue auctions are recovered after a restart. No browser timer
closes an auction and no bid extends a deadline.
