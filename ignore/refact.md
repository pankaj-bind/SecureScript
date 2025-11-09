# Refactoring Example in C++

## 1. Problem Statement

We want to calculate the total price of items in a shopping cart, including tax.
Each item has a **name**, **quantity**, and **price per unit**.

---

## 2. Original Code (Needs Refactoring)

```cpp
#include <iostream>
#include <vector>
#include <string>
using namespace std;

double calc(vector<vector<string>> cart, double t) {
    double total = 0;
    for (int i = 0; i < cart.size(); i++) {
        int qty = stoi(cart[i][1]);
        double price = stod(cart[i][2]);
        total = total + qty * price;
    }
    total = total + (total * t);
    cout << "Total Price is: " << total << endl;
    return total;
}

int main() {
    vector<vector<string>> items = {
        {"apple", "2", "30"},
        {"banana", "5", "10"},
        {"milk", "1", "50"}
    };

    calc(items, 0.05);
    return 0;
}
```

### Issues

1. **Poor naming**: `calc`, `t` are not descriptive.
2. **Data representation**: Using `vector<vector<string>>` is unsafe and requires parsing.
3. **Mixing concerns**: Function prints and calculates together (bad separation of concerns).
4. **Performance**: Passing by value instead of reference → unnecessary copying.
5. **Maintainability**: Code is harder to extend (e.g., adding discounts).

---

## 3. Refactored Code (Clean Version)

```cpp
#include <iostream>
#include <vector>
#include <string>
using namespace std;

// Struct to represent an item
struct Item {
    string name;
    int quantity;
    double pricePerUnit;
};

// Function to calculate total including tax
double calculateTotal(const vector<Item>& cart, double taxRate) {
    double subtotal = 0;
    for (const auto& item : cart) {
        subtotal += item.quantity * item.pricePerUnit;
    }
    double total = subtotal * (1 + taxRate);
    return total;
}

int main() {
    vector<Item> items = {
        {"apple", 2, 30},
        {"banana", 5, 10},
        {"milk", 1, 50}
    };

    double totalPrice = calculateTotal(items, 0.05);
    cout << "Total Price is: " << totalPrice << endl;
    return 0;
}
```

---

## 4. Improvements

✅ **Readability** – clear struct `Item` for cart data.
✅ **Descriptive names** – `calculateTotal`, `taxRate`.
✅ **Type safety** – no `stoi`/`stod` conversions.
✅ **Performance** – passed by `const reference`.
✅ **Separation of concerns** – calculation and printing are separate.
✅ **Maintainability** – easy to extend with new features (e.g., discounts, coupons).

---

## 5. Example Output

```
Total Price is: 157.5
```

*(For 2 apples @30, 5 bananas @10, 1 milk @50, with 5% tax.)*

---

## 6. Key Takeaways

* Always use **strong types** (`struct`/`class`) instead of raw nested vectors.
* Separate **calculation logic** from **I/O logic**.
* Use **descriptive names** for functions and variables.
* Prefer **const references** for efficiency.

---