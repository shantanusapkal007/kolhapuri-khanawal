"use client";

import React, { useState } from "react";
import {
  Building2,
  Clock,
  Phone,
  Plus,
  CheckCircle2,
  Truck,
  ShoppingBag,
  IndianRupee,
  MapPin,
  FileText,
} from "lucide-react";
import { globalRestaurantStore } from "@/lib/store/restaurant-store";
import { OfficeGroupOrder } from "@/types/domain";

export default function OfficeOrdersPage() {
  const store = globalRestaurantStore;
  const [, setTick] = useState(0);

  const [showAddModal, setShowAddModal] = useState(false);

  // New office order form
  const [companyName, setCompanyName] = useState("Synechron IT Park, Baner");
  const [contactPerson, setContactPerson] = useState("Rohan Deshmukh");
  const [contactNumber, setContactNumber] = useState("+91 98220 12345");
  const [deliveryType, setDeliveryType] = useState<"PICKUP" | "DELIVERY">("PICKUP");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [pickupDeliveryTime, setPickupDeliveryTime] = useState("13:30");
  const [chickenThaliQty, setChickenThaliQty] = useState<number>(10);
  const [muttonThaliQty, setMuttonThaliQty] = useState<number>(5);
  const [solkadhiQty, setSolkadhiQty] = useState<number>(10);
  const [advancePaid, setAdvancePaid] = useState<number>(3000);
  const [specialInstructions, setSpecialInstructions] = useState("Extra tambda rassa wati, separate packaging");

  const totalAmount = chickenThaliQty * 320 + muttonThaliQty * 440 + solkadhiQty * 40;

  const handleCreateOrder = (e: React.FormEvent) => {
    e.preventDefault();

    const items: OfficeGroupOrder["items"] = [];
    if (chickenThaliQty > 0) {
      items.push({
        menuItemId: "menu-chicken-thali",
        menuItemName: "Special Chicken Thali",
        quantity: chickenThaliQty,
        unitPrice: 320,
        totalPrice: chickenThaliQty * 320,
      });
    }
    if (muttonThaliQty > 0) {
      items.push({
        menuItemId: "menu-mutton-thali",
        menuItemName: "Special Mutton Thali",
        quantity: muttonThaliQty,
        unitPrice: 440,
        totalPrice: muttonThaliQty * 440,
      });
    }
    if (solkadhiQty > 0) {
      items.push({
        menuItemId: "menu-solkadhi",
        menuItemName: "Kolhapuri Solkadhi Glass",
        quantity: solkadhiQty,
        unitPrice: 40,
        totalPrice: solkadhiQty * 40,
      });
    }

    store.createOfficeOrder({
      orderNumber: `OFF-${Date.now().toString().slice(-4)}`,
      companyName,
      contactPerson,
      contactNumber,
      pickupDeliveryTime: `${new Date().toISOString().split("T")[0]}T${pickupDeliveryTime}:00Z`,
      deliveryType,
      deliveryAddress: deliveryType === "DELIVERY" ? deliveryAddress : undefined,
      items,
      totalAmount,
      advancePaid,
      paymentStatus: advancePaid >= totalAmount ? "PAID" : advancePaid > 0 ? "PARTIALLY_PAID" : "PENDING",
      paymentMethod: "UPI",
      status: "ORDERED",
      specialInstructions,
    });

    setShowAddModal(false);
    setTick((t) => t + 1);
  };

  const handleUpdateStatus = (orderId: string, nextStatus: OfficeGroupOrder["status"]) => {
    store.updateOfficeOrderStatus(orderId, nextStatus);
    setTick((t) => t + 1);
  };

  const totalRevenue = store.officeOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const totalAdvance = store.officeOrders.reduce((sum, o) => sum + o.advancePaid, 0);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-[#E7E2DA] shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-red-700 text-xs font-black uppercase tracking-wider">
            <Building2 className="w-4 h-4" />
            <span>बाणेर आयटी ऑफिस ऑर्डर्स • Baner IT Group Orders</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-stone-900 mt-1">
            Office & Group Bulk Orders Desk
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 font-medium">
            Dedicated catering dispatch for Hinjawadi Phase 1/2 & Baner tech teams (Persistent, TCS, Cognizant, Synechron).
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-black px-5 py-3 rounded-xl text-sm shadow-md shadow-red-700/20 active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>+ नवीन ग्रुप ऑर्डर (New Group Order)</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="luxury-card p-5 rounded-2xl border border-[#E7E2DA] space-y-1">
          <div className="text-xs font-bold text-stone-500">Total Group Orders Value</div>
          <div className="text-3xl font-black text-stone-900 font-mono">
            ₹{totalRevenue.toLocaleString("en-IN")}
          </div>
          <p className="text-[11px] text-stone-400 font-medium">Across scheduled IT catering dispatches</p>
        </div>

        <div className="luxury-card p-5 rounded-2xl border border-[#E7E2DA] space-y-1">
          <div className="text-xs font-bold text-stone-500">Advance Collected</div>
          <div className="text-3xl font-black text-emerald-700 font-mono">
            ₹{totalAdvance.toLocaleString("en-IN")}
          </div>
          <p className="text-[11px] text-emerald-600 font-bold">UPI advances verified in bank</p>
        </div>

        <div className="luxury-card p-5 rounded-2xl border border-[#E7E2DA] space-y-1">
          <div className="text-xs font-bold text-stone-500">Pending Balance To Collect</div>
          <div className="text-3xl font-black text-amber-700 font-mono">
            ₹{(totalRevenue - totalAdvance).toLocaleString("en-IN")}
          </div>
          <p className="text-[11px] text-stone-500 font-medium">Collect on delivery/pickup</p>
        </div>
      </div>

      {/* Orders List */}
      <div className="space-y-4">
        {store.officeOrders.map((order) => {
          const balanceDue = order.totalAmount - order.advancePaid;
          return (
            <div
              key={order.id}
              className="bg-white rounded-3xl border border-[#E7E2DA] p-6 shadow-xs space-y-4 hover:border-amber-400 transition-colors"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 bg-stone-100 text-stone-700 rounded-md">
                      {order.orderNumber}
                    </span>
                    <h3 className="font-black text-stone-900 text-base">{order.companyName}</h3>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-stone-500 mt-1">
                    <span>Contact: <strong className="text-stone-800">{order.contactPerson}</strong></span>
                    <span>•</span>
                    <span className="flex items-center gap-1 font-mono">
                      <Phone className="w-3 h-3" /> {order.contactNumber}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-black uppercase ${
                      order.status === "COMPLETED"
                        ? "bg-emerald-100 text-emerald-800"
                        : order.status === "PREPARING"
                        ? "bg-amber-100 text-amber-800 border border-amber-300 animate-pulse"
                        : "bg-blue-100 text-blue-800"
                    }`}
                  >
                    {order.status}
                  </span>
                  <span className="text-xs font-bold px-2.5 py-1 bg-stone-100 rounded-full text-stone-700">
                    {order.deliveryType}
                  </span>
                </div>
              </div>

              {/* Items List */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {order.items.map((it, idx) => (
                  <div key={idx} className="p-3 bg-stone-50 rounded-xl border border-stone-100 text-xs flex justify-between items-center">
                    <div>
                      <div className="font-bold text-stone-900">{it.menuItemName}</div>
                      <div className="text-stone-400 font-medium">Qty: {it.quantity}</div>
                    </div>
                    <div className="font-mono font-black text-stone-800">
                      ₹{it.totalPrice.toLocaleString("en-IN")}
                    </div>
                  </div>
                ))}
              </div>

              {order.specialInstructions && (
                <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200/80 text-xs text-amber-950 font-medium">
                  <strong>Instructions: </strong> {order.specialInstructions}
                </div>
              )}

              {/* Financial Breakdown & Actions */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-stone-100">
                <div className="flex items-center gap-4 text-xs">
                  <div>
                    <span className="text-stone-400 font-medium">Total: </span>
                    <strong className="font-mono text-sm text-stone-900">₹{order.totalAmount}</strong>
                  </div>
                  <div>
                    <span className="text-stone-400 font-medium">Advance Paid: </span>
                    <strong className="font-mono text-sm text-emerald-700">₹{order.advancePaid}</strong>
                  </div>
                  <div>
                    <span className="text-stone-400 font-medium">Balance Due: </span>
                    <strong className="font-mono text-sm text-red-700">₹{balanceDue}</strong>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {order.status === "ORDERED" && (
                    <button
                      onClick={() => handleUpdateStatus(order.id, "PREPARING")}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow-xs"
                    >
                      Start Kitchen Prep
                    </button>
                  )}
                  {order.status === "PREPARING" && (
                    <button
                      onClick={() => handleUpdateStatus(order.id, "READY")}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs"
                    >
                      Mark Ready For Dispatch
                    </button>
                  )}
                  {order.status === "READY" && (
                    <button
                      onClick={() => handleUpdateStatus(order.id, "COMPLETED")}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs"
                    >
                      Confirm Delivered & Settle
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* New Group Order Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full border border-[#E7E2DA] shadow-2xl space-y-4 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#E7E2DA] pb-3">
              <div>
                <h3 className="text-base font-black text-stone-900">New Baner IT Group Order</h3>
                <p className="text-xs text-stone-500 font-medium">Bulk Thali catering with advance tracking</p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full bg-stone-100 font-bold text-stone-500"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateOrder} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-stone-700">Company / IT Park Name</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full mt-1 p-2.5 text-sm rounded-xl border border-stone-200 bg-white font-bold"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-stone-700">Contact Person</label>
                  <input
                    type="text"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    className="w-full mt-1 p-2.5 text-sm rounded-xl border border-stone-200 bg-white font-medium"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-stone-700">Phone Number</label>
                  <input
                    type="text"
                    value={contactNumber}
                    onChange={(e) => setContactNumber(e.target.value)}
                    className="w-full mt-1 p-2.5 text-sm rounded-xl border border-stone-200 bg-white font-medium"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-stone-700">Delivery Type</label>
                  <select
                    value={deliveryType}
                    onChange={(e) => setDeliveryType(e.target.value as any)}
                    className="w-full mt-1 p-2.5 text-sm rounded-xl border border-stone-200 bg-white font-bold"
                  >
                    <option value="PICKUP">Office Pickup at Counter</option>
                    <option value="DELIVERY">Delivery to IT Park</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-stone-700">Target Time</label>
                  <input
                    type="time"
                    value={pickupDeliveryTime}
                    onChange={(e) => setPickupDeliveryTime(e.target.value)}
                    className="w-full mt-1 p-2.5 text-sm rounded-xl border border-stone-200 bg-white font-bold"
                    required
                  />
                </div>
              </div>

              {/* Quantities */}
              <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200 space-y-3">
                <div className="text-xs font-bold text-stone-700">Thali Quantities</div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-stone-600">Chicken Thalis</label>
                    <input
                      type="number"
                      min="0"
                      value={chickenThaliQty}
                      onChange={(e) => setChickenThaliQty(parseInt(e.target.value) || 0)}
                      className="w-full mt-1 p-2 text-sm rounded-lg border border-stone-200 bg-white font-bold text-center"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-stone-600">Mutton Thalis</label>
                    <input
                      type="number"
                      min="0"
                      value={muttonThaliQty}
                      onChange={(e) => setMuttonThaliQty(parseInt(e.target.value) || 0)}
                      className="w-full mt-1 p-2 text-sm rounded-lg border border-stone-200 bg-white font-bold text-center"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-stone-600">Solkadhi Glasses</label>
                    <input
                      type="number"
                      min="0"
                      value={solkadhiQty}
                      onChange={(e) => setSolkadhiQty(parseInt(e.target.value) || 0)}
                      className="w-full mt-1 p-2 text-sm rounded-lg border border-stone-200 bg-white font-bold text-center"
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-stone-200 text-xs font-bold">
                  <span>Order Total:</span>
                  <span className="font-mono text-base font-black text-stone-900">
                    ₹{totalAmount.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700">Advance Paid via UPI (₹)</label>
                <input
                  type="number"
                  min="0"
                  max={totalAmount}
                  value={advancePaid}
                  onChange={(e) => setAdvancePaid(parseFloat(e.target.value) || 0)}
                  className="w-full mt-1 p-2.5 text-sm rounded-xl border border-stone-200 bg-white font-black font-mono text-base text-emerald-700"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700">Packaging & Special Instructions</label>
                <input
                  type="text"
                  placeholder="e.g. Extra tambda rassa wati + chopped kanda limbu"
                  value={specialInstructions}
                  onChange={(e) => setSpecialInstructions(e.target.value)}
                  className="w-full mt-1 p-2.5 text-sm rounded-xl border border-stone-200 bg-white font-medium text-xs"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-stone-200 text-stone-600 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md shadow-red-700/20 active:scale-95"
                >
                  Confirm Group Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
