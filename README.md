# ⚙️ ManageFlat Backend

The robust backend engine for **ManageFlat**, a premium apartment management platform. Built with **Node.js**, **Express.js**, and **MongoDB**, it handles secure authentication, payment processing, and complex data relationships.

---

## 🚀 Key Responsibilities

*   🔐 **Secure Authentication**: Integrated with Firebase Admin SDK for role-based access control.
*   💳 **Payment Engine**: Stripe API integration for secure rent transactions.
*   🏠 **Data Management**: Handles complex apartment, agreement, and user data models in MongoDB.
*   🎟️ **Coupon Logic**: Server-side validation and management for discount coupons.
*   📢 **Announcements**: Dynamic routing for community-wide notifications.

---

## 🛠️ Tech Stack

*   **Runtime**: Node.js
*   **Framework**: Express.js
*   **Database**: MongoDB
*   **Auth**: Firebase Admin SDK
*   **Payments**: Stripe API
*   **Env Management**: dotenv

---

## 🔧 Setup & Installation

1.  **Install Dependencies**:
    ```bash
    npm install
    ```
2.  **Environment Variables**:
    Create a `.env` file with:
    ```ini
    DB_USER=your_db_user
    DB_PASS=your_db_pass
    STRIPE_API_KEY=your_stripe_key
    FB_SERVICE_KEY=your_base64_encoded_service_account_json
    PORT=3000
    ```
3.  **Run Server**:
    ```bash
    node index.js
    ```

---

## 👨‍💻 Author

**Asibur Rahman**  
Senior IT Officer, Shishir Knitting & Dyeing (AD Group)  
📧 [asiburrahman.dev@gmail.com](mailto:asiburrahman.dev@gmail.com)  
🌐 [LinkedIn](https://www.linkedin.com/in/asiburrahman)
