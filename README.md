# ShareCount

ShareCount is a tool for tracking and managing shared expenses among groups. Easily split bills, keep track of payments, and settle up with friends or colleagues.

## Features

- Add and manage groups
- Record shared expenses
- Track individual balances
- Generate reports for settlements

## How to use:

```bash
podman compose -f docker/docker-compose.yml up
```

### Deploy

Create `backend/.env` (`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT`, `FRONT_URL`, `LISTENING_URL`). In the containers, `DATABASE_SERVER`, `LISTENING_URL` and `POSTGRES_PORT` are overridden by `docker/docker-compose.yml`. `FRONT_URL` must be the origin of the deployed frontend (e.g. `https://<user>.github.io`, no path). Then:

```bash
docker/deploy.sh                 # pull, back up the DB, rebuild, restart, health check
docker/deploy.sh --ref v1.2.0    # deploy a specific branch, tag or commit
docker/deploy.sh --help          # all options
```

Database dumps are kept in `docker/backups/` (last 10). Migrations run automatically when the backend starts.

Machine-specific compose changes (e.g. exposing the database port) go in `docker/docker-compose.override.yml`, which is git-ignored and loaded by `deploy.sh`. Start from `docker/docker-compose.override.example.yml`.

## Getting Started

### 1. Clone the repository
```bash
git clone https://github.com/f4r3n/shareCount.git
cd shareCount
```

### 2. Install dependencies

#### Backend (Rust)
- Ensure you have [Rust](https://www.rust-lang.org/tools/install) installed.
- Postgresql (libpq-dev)
- Install backend dependencies:
    ```bash
    cd backend
    cargo build
    ```

#### Frontend (Node.js)
- Ensure you have [Node.js](https://nodejs.org/) installed.
- Install frontend dependencies:
```bash
    cd frontend
    npm install
```

### 3. Run the application

#### Start the backend server:
```bash
cd backend
cargo run
```

#### Start the frontend:
```bash
cd frontend
npm run dev
```

## Contributing

Contributions are welcome! Please open issues or submit pull requests.

## License

This project is licensed under the Apache-2.0 license.
