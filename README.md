# ShareCount

ShareCount is a tool for tracking and managing shared expenses among groups. Easily split bills, keep track of payments, and settle up with friends or colleagues.

## Features

- Add and manage groups
- Record shared expenses
- Track individual balances
- Generate reports for settlements

## Getting Started

### 1. Clone the repository
```bash
git clone https://github.com/f4r3n/shareCount.git
cd shareCount
```

### 2. Install dependencies

#### Backend (Rust)
- Ensure you have [Rust](https://www.rust-lang.org/tools/install) installed.
- Postgresql
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
