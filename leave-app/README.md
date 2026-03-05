# Getting Started

## Frontend

### Setup and Run for Development

1. Open the `frontend` folder in the terminal.

2. Run the following command for a clean install:

```bash
npm ci
```

3. Create a `.env` file inside the `frontend` directory and add:

```bash
VITE_API_BASE=http://{your_network_ip}:8080/api
```

4. Start the frontend development server:

```bash
npm run dev
```

> You may see your network IP in the terminal once the frontend starts.

5. In a separate terminal (open the `frontend` directory again to clearly separate the frontend and mock server processes), run the mock server:

```bash
npm run mock-server
```
