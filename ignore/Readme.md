# SecureScript: System Hardening Tool

SecureScript is a full-stack application designed to automate system hardening based on CIS (Center for Internet Security) guidelines. It features a Django backend and a React frontend packaged within an Electron desktop application.

-----

## Prerequisites

Before you begin, ensure you have the following installed on your system:

  * **Python 3.x**
  * **Node.js** and **npm**

-----
## Clone from GitHub

To get started, first clone the SecureScript repository to your local machine using Git:

```bash
git clone https://github.com/pankaj-bind/SecureScript.git
cd SecureScript
```

## Backend Setup (Django)

Follow these steps to get the backend server up and running.

1.  **Navigate to the Backend Directory**
    Open your terminal and change into the `backend` directory.

    ```bash
    cd backend
    ```

2.  **Install Python Dependencies**
    Install all the required packages listed in `requirements.txt`. It's recommended to do this within a virtual environment.

    ```bash
    pip install -r requirements.txt
    ```

3.  **Start the Backend Server**
    This will start the Django development server, typically on `http://localhost:8000`.

    ```bash
    python manage.py runserver
    ```

    You can keep this terminal window open to see server logs.

-----

## Frontend Setup (React + Electron)

In a **new terminal window**, follow these steps to set up and run the frontend application.

1.  **Navigate to the Frontend Directory**

    ```bash
    cd frontend
    ```

2.  **Install Node.js Dependencies**
    This command installs all the necessary packages defined in `package.json`.

    ```bash
    npm install
    ```

3.  **Run in Development Mode**
    This single command starts both the React development server and the Electron application concurrently.It will automatically open the application window for you.

    ```bash
    npm run dev
    ```

    The application will now be running and connected to your local backend server.
