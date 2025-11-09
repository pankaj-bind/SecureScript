
## 1. **Long Function**

> Function tries to do too many things.

### Smelly Code:

```cpp
#include <iostream>
#include <vector>
using namespace std;

struct Item {
    string name;
    int qty;
    double price;
};

void processOrder(vector<Item> cart) {
    // Validate
    if (cart.empty()) {
        cout << "Cart is empty\n";
        return;
    }

    // Calculate total
    double total = 0;
    for (auto &item : cart) {
        total += item.price * item.qty;
    }

    // Print receipt
    cout << "Receipt:\n";
    for (auto &item : cart) {
        cout << item.name << " x" << item.qty << " = " << item.price * item.qty << "\n";
    }
    cout << "Total = " << total << "\n";
}
```

👉 **Why smell?**
Validation, calculation, and printing are all mixed in one big function.

### Refactored:

```cpp
void validateCart(const vector<Item>& cart) {
    if (cart.empty()) throw runtime_error("Cart is empty");
}

double calculateTotal(const vector<Item>& cart) {
    double total = 0;
    for (auto &item : cart) total += item.price * item.qty;
    return total;
}

void printReceipt(const vector<Item>& cart, double total) {
    cout << "Receipt:\n";
    for (auto &item : cart) {
        cout << item.name << " x" << item.qty << " = " << item.price * item.qty << "\n";
    }
    cout << "Total = " << total << "\n";
}
```

---

## 2. **Duplicated Code**

> Same logic repeated in multiple places.

### Smelly Code:

```cpp
double areaRectangle(double w, double h) {
    return w * h;
}

double areaSquare(double s) {
    return s * s; // duplicate logic
}
```

### Refactored:

```cpp
double area(double w, double h = -1) {
    if (h == -1) return w * w;  // square
    return w * h;               // rectangle
}
```

---

## 3. **Magic Numbers**

> Using unexplained constants directly.

### Smelly Code:

```cpp
double circumference(double r) {
    return 2 * 3.14159 * r;  // why 3.14159?
}
```

### Refactored:

```cpp
const double PI = 3.14159;

double circumference(double r) {
    return 2 * PI * r;
}
```

---