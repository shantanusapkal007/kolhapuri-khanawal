# PHYSICAL_PILOT_GUIDE.md — 3-Day In-Restaurant Pilot Protocol
**Kolhapuri Khanawal Restaurant Operating System**

---

## 1. PHYSICAL NETWORK & DEPLOYMENT ARCHITECTURE

The system is configured as an **On-Premise, Local-First Restaurant System**. All data is stored and processed directly on the restaurant's counter computer, eliminating external cloud dependency and allowing full operation even if the internet goes down.

```
                    RESTAURANT Wi-Fi (Local LAN Router)
                                  │
          ┌───────────────────────┼───────────────────────┐
          ↓                       ↓                       ↓
      Waiter 1 (W1)           Waiter 2 (W2)            Cashier
     Android Phone           Android Phone            Counter PC
     (Chrome / PWA)          (Chrome / PWA)       (http://localhost:3000)
          │                       │                       │
          └───────────────────────┼───────────────────────┘
                                  ↓
                       Counter / Mini-PC Server
                              Node.js 22
                                  │
                          SQLite (WAL Mode)
                           (./data/pos.db)
                                  │
          ┌───────────────────────┴───────────────────────┐
          ↓                                               ↓
     KOT Printer                                     Bill Printer
(POSIFLOW KP307-UEWB Kitchen)                 (POSIFLOW KP307-UEWB Cashier)
  Port 9100 / RawBT / USB                        Port 9100 / RawBT / USB
```

---

## 2. HARDWARE SETUP CHECKLIST (BEFORE DAY 1)

| Hardware | Requirement | Setup Instructions |
| :--- | :--- | :--- |
| **Counter PC** | Windows PC, Intel NUC, or Mini-PC running Node.js 22 LTS | Connect to restaurant Wi-Fi/Ethernet. Double-click `start-counter-pos.bat`. Note the printed IP address (e.g. `192.168.1.50`). |
| **Wi-Fi Router** | Standard 2.4/5GHz Wi-Fi Router (No active internet required) | Ensure all waiter phones and the counter PC connect to the **same** Wi-Fi network. |
| **Waiter Phones** | Android smartphones running Chrome or Samsung Internet | Open Chrome $\rightarrow$ Navigate to `http://<COUNTER_IP>:3000` $\rightarrow$ Tap Browser Menu (`⋮`) $\rightarrow$ Tap **"Add to Home Screen"** or **"Install app"**. |
| **KOT Printer** | POSIFLOW KP307-UEWB (Kitchen Station) | Connect Ethernet cable to router or USB to Counter PC. Loaded with 80mm thermal paper. |
| **Bill Printer** | POSIFLOW KP307-UEWB (Cashier Counter) | Connect via USB or Ethernet to Counter PC. Loaded with 80mm or 58mm thermal paper. Cash drawer cable connected. |

---

## 3. THE 2–3 DAY PILOT PROTOCOL

### Critical Golden Rule for Observers:
> [!IMPORTANT]
> **DO NOT instruct the staff or tell them how the system is supposed to work.**  
> Give them their login PINs, hand them the phones, and let them use the system naturally during live lunch and dinner service.  
> Step back, observe their instinctive reactions, note where they hesitate, and record real-world friction.

---

## 4. THE 10-POINT DAILY PILOT SCORECARD

Record this scorecard at the end of each shift (Lunch & Dinner) during the 3-day pilot:

| # | Inspection Parameter | Shift 1 (Day 1) | Shift 2 (Day 1) | Shift 3 (Day 2) | Shift 4 (Day 2) | Shift 5 (Day 3) | Shift 6 (Day 3) | Target |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| 1 | **Order lost?** | [ ] YES  [ ] NO | [ ] YES  [ ] NO | [ ] YES  [ ] NO | [ ] YES  [ ] NO | [ ] YES  [ ] NO | [ ] YES  [ ] NO | **NO** |
| 2 | **Duplicate KOT?** | [ ] YES  [ ] NO | [ ] YES  [ ] NO | [ ] YES  [ ] NO | [ ] YES  [ ] NO | [ ] YES  [ ] NO | [ ] YES  [ ] NO | **NO** |
| 3 | **Wrong bill?** | [ ] YES  [ ] NO | [ ] YES  [ ] NO | [ ] YES  [ ] NO | [ ] YES  [ ] NO | [ ] YES  [ ] NO | [ ] YES  [ ] NO | **NO** |
| 4 | **Printer failure?** | [ ] YES  [ ] NO | [ ] YES  [ ] NO | [ ] YES  [ ] NO | [ ] YES  [ ] NO | [ ] YES  [ ] NO | [ ] YES  [ ] NO | **NO** |
| 5 | **Payment issue?** | [ ] YES  [ ] NO | [ ] YES  [ ] NO | [ ] YES  [ ] NO | [ ] YES  [ ] NO | [ ] YES  [ ] NO | [ ] YES  [ ] NO | **NO** |
| 6 | **Table conflict?** | [ ] YES  [ ] NO | [ ] YES  [ ] NO | [ ] YES  [ ] NO | [ ] YES  [ ] NO | [ ] YES  [ ] NO | [ ] YES  [ ] NO | **NO** |
| 7 | **App crash?** | [ ] YES  [ ] NO | [ ] YES  [ ] NO | [ ] YES  [ ] NO | [ ] YES  [ ] NO | [ ] YES  [ ] NO | [ ] YES  [ ] NO | **NO** |
| 8 | **Offline issue?** | [ ] YES  [ ] NO | [ ] YES  [ ] NO | [ ] YES  [ ] NO | [ ] YES  [ ] NO | [ ] YES  [ ] NO | [ ] YES  [ ] NO | **NO** |
| 9 | **Slow workflow?** | [ ] YES  [ ] NO | [ ] YES  [ ] NO | [ ] YES  [ ] NO | [ ] YES  [ ] NO | [ ] YES  [ ] NO | [ ] YES  [ ] NO | **NO** |
| 10| **Staff confusion?** | [ ] YES  [ ] NO | [ ] YES  [ ] NO | [ ] YES  [ ] NO | [ ] YES  [ ] NO | [ ] YES  [ ] NO | [ ] YES  [ ] NO | **NO** |

---

## 5. OBSERVATION GUIDE: WHAT TO WATCH FOR

### A. Wi-Fi Coverage & Android Behavior
- Are there Wi-Fi "dead zones" in the dining hall (e.g. corner tables `A3` or `C4`)?
- Does the Android phone screen timeout/lock in the waiter's pocket? When unlocked, does the PWA reconnect instantly without refreshing the cart?
- Does the hardware Android back button properly close sheets/drawers instead of exiting the app?

### B. Kitchen & Thermal Printer Mechanics
- Does the kitchen staff hear the KOT print buzzer during peak restaurant rush noise?
- Is the Marathi/Devanagari text clearly legible on thermal paper (no overlapping characters or blurriness)?
- When 80mm paper runs out mid-shift, does the cashier tear off the roll, reload, and tap **Reprint** without creating a duplicate order?
- Does the cash drawer kick reliably on 1-tap cash settlement?

### C. Waiter Speed & Natural Ergonomics
- Are waiters using the top **Fast Sellers Strip** (*वारंवार मागवले जाणारे*) for water bottles, extra bhakri, and rassa?
- Do waiters hesitate when selecting Half/Full thalis or bread options (Jowar vs Bajra)?
- Are they able to punch a 5-item order and send KOT in **under 15 seconds**?

### D. Cashier & Financial Reconciliation
- Does the Day-End Z-Report Cash total match physical cash in the drawer?
- Does the UPI ledger match the restaurant's Paytm/PhonePe/GPay merchant soundbox notifications?
- Were there any table transfers (e.g. guest moved from `B1` to `B2`) or item cancellations? Were they correctly reflected on the final bill?

---

## 6. END-OF-DAY PILOT RECONCILIATION SHEET

At the end of each pilot day, run the following verification:

1. **Cash Drawer Verification:**
   - Physical Cash in Drawer: ₹ ______________
   - System Cash Ledger Total: ₹ ______________
   - Discrepancy (if any): ₹ ______________

2. **UPI Merchant Soundbox Verification:**
   - Soundbox / Bank UPI Total: ₹ ______________
   - System UPI Ledger Total: ₹ ______________
   - Discrepancy (if any): ₹ ______________

3. **Backup Check:**
   - Verify timestamped backup was generated in `data/backups/pos-backup-*.db`.

---

## 7. SIGN-OFF CRITERIA FOR FORMAL CLIENT HANDOVER

The system is considered officially ready for final handover when:
1. **3 Consecutive Days** of live service complete with **all 10 Scorecard parameters marked "NO"**.
2. Staff can operate the full cycle (Seat $\rightarrow$ Order $\rightarrow$ KOT $\rightarrow$ Bill $\rightarrow$ Settle) independently without asking for help.
3. Daily physical cash and UPI soundbox totals match the software to the exact rupee for 3 days in a row.
