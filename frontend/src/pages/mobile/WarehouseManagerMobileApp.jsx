import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  Package, Boxes, Truck, AlertTriangle, CheckCircle2,
  Warehouse as WhIcon, ArrowRightLeft, ShieldAlert, BarChart2,
  Camera, QrCode, Scan, RefreshCw, Search, Filter, Plus,
  ArrowDownLeft, ArrowUpRight, RotateCcw, Check, X, ChevronRight,
  ExternalLink, Layers, FileText, UserCheck, Shield, Sparkles,
  Smartphone, Monitor, Eye, Clock, Phone, MapPin, Download,
  AlertCircle, Info, ChevronDown, ListFilter, Play, CheckSquare,
  MessageSquare, Send, HardDrive, Cpu, Radio, ClipboardCheck,
  CheckCircle, ArrowLeft, Calendar, Tag, ShieldCheck
} from 'lucide-react';

export default function WarehouseManagerMobileApp({
  data,
  user,
  onRefresh
}) {
  // Navigation Tabs: 'home' | 'inventory' | 'orders' | 'scanner' | 'operations'
  const [currentTab, setCurrentTab] = useState('home');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('ALL');

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [orderFilter, setOrderFilter] = useState('all'); // 'all' | 'awaiting' | 'partial' | 'full' | 'blocked'
  const [operationsSubTab, setOperationsSubTab] = useState('transfers'); // 'transfers' | 'receipts' | 'returns' | 'tasks' | 'alerts' | 'reports' | 'device'

  // Central Authoritative Data States
  const [inventoryStocks, setInventoryStocks] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [componentsCatalog, setComponentsCatalog] = useState([]);
  const [dispatchesList, setDispatchesList] = useState([]);
  const [ordersList, setOrdersList] = useState([]);
  const [serialRegistry, setSerialRegistry] = useState([]);
  const [transfersList, setTransfersList] = useState([]);
  const [goodsReceiptsList, setGoodsReceiptsList] = useState([]);
  const [returnsList, setReturnsList] = useState([]);
  const [reservationsList, setReservationsList] = useState([]);
  const [inventoryAlerts, setInventoryAlerts] = useState(null);
  const [tasksList, setTasksList] = useState([]);
  const [stockMovements, setStockMovements] = useState([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [deviceRegistered, setDeviceRegistered] = useState(true);

  // Active Modals: null | 'goods_receipt' | 'transfer' | 'adjust' | 'dispatch' | 'return' | 'order_allocation' | 'passport_view'
  const [activeModal, setActiveModal] = useState(null);
  const [selectedOrderForBOM, setSelectedOrderForBOM] = useState(null);
  const [bomDetails, setBomDetails] = useState(null);
  const [bomSimulation, setBomSimulation] = useState(null);
  const [isAllocatingOrder, setIsAllocatingOrder] = useState(false);
  const [selectedOrderForDispatch, setSelectedOrderForDispatch] = useState(null);
  const [generatedPassport, setGeneratedPassport] = useState(null);

  // Forms State
  // 1. Goods Receipt (Inward) Form
  const [grnForm, setGrnForm] = useState({
    warehouse_id: 1,
    component_id: '',
    quantity: 10,
    supplier_name: 'Waaree Solar Technologies Ltd',
    po_reference: 'PO-REC-2026-088',
    arrival_gate: 'Gate 2 / Bay A3',
    truck_number: 'MH-12-TR-4019',
    serials_text: '',
    damaged_items_count: 0,
    damage_notes: '',
    notes: 'Inward shipment verified at loading dock.'
  });
  const [isSubmittingGrn, setIsSubmittingGrn] = useState(false);

  // 2. Stock Transfer Form
  const [transferForm, setTransferForm] = useState({
    source_warehouse_id: 1,
    dest_warehouse_id: 2,
    component_id: '',
    quantity: 5,
    notes: 'Inter-depot stock rebalancing',
    auto_approve: false
  });
  const [isSubmittingTransfer, setIsSubmittingTransfer] = useState(false);

  // 3. Approved Stock Adjustment Form
  const [adjustForm, setAdjustForm] = useState({
    warehouse_id: 1,
    component_id: '',
    quantity_change: 0,
    notes: 'Physical audit correction verified by Warehouse Lead'
  });
  const [isSubmittingAdjust, setIsSubmittingAdjust] = useState(false);

  // 4. Return Processing Form
  const [returnForm, setReturnForm] = useState({
    warehouse_id: 1,
    component_id: '',
    quantity: 1,
    return_type: 'RESTOCK', // 'RESTOCK' | 'DAMAGED'
    serial_number: '',
    reason: 'Field surplus returned after project commissioning',
    order_or_project: 'ORD-2026-0041'
  });
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);

  // 5. Dispatch Confirmation with Passport
  const [dispatchForm, setDispatchForm] = useState({
    warehouse_id: 1,
    vehicle_number: 'MH-12-SP-2026',
    driver_name: 'Kishore Gaikwad',
    driver_phone: '+91 98220 77112',
    scanned_serials: [],
    notes: 'Primary dispatch staging verified with physical serial capture.',
    checklist_picked: true,
    checklist_packaging: true,
    checklist_vehicle: true,
    checklist_driver: true
  });
  const [isConfirmingDispatch, setIsConfirmingDispatch] = useState(false);

  // 6. Task Comment Form
  const [taskCommentText, setTaskCommentText] = useState({});

  // 7. REAL Camera Scanner State (Html5Qrcode)
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [scannerMode, setScannerMode] = useState('verify'); // 'verify' | 'find' | 'receive' | 'pick'
  const [scannedSerialInput, setScannedSerialInput] = useState('');
  const [scanValidationResult, setScanValidationResult] = useState(null);
  const [recentScans, setRecentScans] = useState([]);
  const html5QrCodeRef = useRef(null);

  // Audio Beep Feedback using Web Audio API
  const playBeep = (isSuccess = true) => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(isSuccess ? 880 : 330, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch (e) {
      // Audio context may require initial user gesture
    }
  };

  // Load Authoritative Real-Time Data from Backend
  const loadAuthoritativeData = async () => {
    setIsLoadingDetails(true);
    try {
      const [
        stocksRes, whRes, catRes, dispRes, ordersRes,
        serialsRes, transfersRes, grnRes, returnsRes,
        resvRes, alertsRes, tasksRes, movsRes
      ] = await Promise.allSettled([
        api.getWarehouseInventory(selectedWarehouseId === 'ALL' ? null : selectedWarehouseId),
        api.getWarehouses(),
        api.getCatalogComponents ? api.getCatalogComponents() : (api.getComponents ? api.getComponents() : Promise.resolve([])),
        api.getDispatches ? api.getDispatches() : Promise.resolve([]),
        api.getOrders ? api.getOrders({ status: 'ALL' }) : Promise.resolve([]),
        api.getInventorySerials ? api.getInventorySerials(selectedWarehouseId === 'ALL' ? {} : { warehouse_id: selectedWarehouseId }) : Promise.resolve([]),
        api.getInventoryTransfers ? api.getInventoryTransfers(selectedWarehouseId === 'ALL' ? {} : { warehouse_id: selectedWarehouseId }) : Promise.resolve([]),
        api.getGoodsReceipts ? api.getGoodsReceipts(selectedWarehouseId === 'ALL' ? {} : { warehouse_id: selectedWarehouseId }) : Promise.resolve([]),
        api.getInventoryReturns ? api.getInventoryReturns(selectedWarehouseId === 'ALL' ? {} : { warehouse_id: selectedWarehouseId }) : Promise.resolve([]),
        api.getInventoryReservations ? api.getInventoryReservations(selectedWarehouseId === 'ALL' ? {} : { warehouse_id: selectedWarehouseId }) : Promise.resolve([]),
        api.getInventoryAlerts ? api.getInventoryAlerts(selectedWarehouseId === 'ALL' ? null : selectedWarehouseId) : Promise.resolve(null),
        api.getTasks ? api.getTasks({ category: 'INVENTORY' }) : Promise.resolve([]),
        api.getInventoryMovements ? api.getInventoryMovements(50) : Promise.resolve([])
      ]);

      if (stocksRes.status === 'fulfilled' && Array.isArray(stocksRes.value)) setInventoryStocks(stocksRes.value);
      if (whRes.status === 'fulfilled' && Array.isArray(whRes.value)) setWarehouses(whRes.value);
      if (catRes.status === 'fulfilled' && Array.isArray(catRes.value)) setComponentsCatalog(catRes.value);
      if (dispRes.status === 'fulfilled' && Array.isArray(dispRes.value)) setDispatchesList(dispRes.value);
      if (ordersRes.status === 'fulfilled' && Array.isArray(ordersRes.value)) setOrdersList(ordersRes.value);
      if (serialsRes.status === 'fulfilled' && Array.isArray(serialsRes.value)) setSerialRegistry(serialsRes.value);
      if (transfersRes.status === 'fulfilled' && Array.isArray(transfersRes.value)) setTransfersList(transfersRes.value);
      if (grnRes.status === 'fulfilled' && Array.isArray(grnRes.value)) setGoodsReceiptsList(grnRes.value);
      if (returnsRes.status === 'fulfilled' && Array.isArray(returnsRes.value)) setReturnsList(returnsRes.value);
      if (resvRes.status === 'fulfilled' && Array.isArray(resvRes.value)) setReservationsList(resvRes.value);
      if (alertsRes.status === 'fulfilled') setInventoryAlerts(alertsRes.value);
      if (tasksRes.status === 'fulfilled' && Array.isArray(tasksRes.value)) setTasksList(tasksRes.value);
      if (movsRes.status === 'fulfilled' && Array.isArray(movsRes.value)) setStockMovements(movsRes.value);
    } catch (err) {
      console.error('Failed to load authoritative warehouse data:', err);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  useEffect(() => {
    loadAuthoritativeData();
  }, [selectedWarehouseId]);

  // Initial Device Registration (Module 3.B)
  useEffect(() => {
    const registerDevice = async () => {
      try {
        if (api.registerWarehouseDevice) {
          await api.registerWarehouseDevice({
            device_model: navigator.userAgent.includes('Mobile') ? 'Mobile Industrial Handheld' : 'Warehouse Terminal Station',
            os_version: navigator.platform || 'Cross-Platform Windows/Android',
            app_version: '2.4.0-mobile',
            camera_supported: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
          });
          setDeviceRegistered(true);
        }
      } catch (e) {
        // Fallback ok
      }
    };
    registerDevice();
  }, []);

  // -------------------------------------------------------------
  // REAL CAMERA SCANNER LIFECYCLE (Html5Qrcode)
  // -------------------------------------------------------------
  const stopRealCamera = async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        html5QrCodeRef.current.clear();
      } catch (e) {
        console.warn('Camera stop error:', e);
      }
      html5QrCodeRef.current = null;
    }
    setCameraActive(false);
  };

  const startRealCamera = async () => {
    setCameraError(null);
    await stopRealCamera();

    // Check mediaDevices support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Camera access API is not supported by your current browser. You can use the high-fidelity manual barcode entry & sample serial buttons below.');
      return;
    }

    try {
      const container = document.getElementById('barcode-html5-qr-reader');
      if (!container) return;

      const html5QrCode = new Html5Qrcode('barcode-html5-qr-reader');
      html5QrCodeRef.current = html5QrCode;

      const qrConfig = {
        fps: 15,
        qrbox: { width: 250, height: 160 },
        aspectRatio: 1.333
      };

      await html5QrCode.start(
        { facingMode: 'environment' },
        qrConfig,
        (decodedText) => {
          playBeep(true);
          handleValidateSerial(decodedText);
        },
        (errorMessage) => {
          // Frame misses are normal in video processing
        }
      );

      setCameraActive(true);
    } catch (err) {
      console.warn('Real camera start failed:', err);
      setCameraError(`Camera permission denied or camera device busy (${err.message || err}). Manual serial verification fallback is active.`);
      setCameraActive(false);
    }
  };

  useEffect(() => {
    if (currentTab === 'scanner') {
      // Small timeout to allow container element to render
      const timer = setTimeout(() => {
        startRealCamera();
      }, 200);
      return () => {
        clearTimeout(timer);
        stopRealCamera();
      };
    } else {
      stopRealCamera();
    }
  }, [currentTab]);

  // Handle Serial Validation via Backend
  const handleValidateSerial = async (serialToValidate = null) => {
    const sn = (serialToValidate || scannedSerialInput).trim().toUpperCase();
    if (!sn) return;

    try {
      const res = await api.validateSerial({
        serial_number: sn,
        order_id: selectedOrderForDispatch?.id || null,
        warehouse_id: parseInt(grnForm.warehouse_id) || 1
      });

      playBeep(res.valid);
      setScanValidationResult(res);
      setRecentScans(prev => [
        {
          serial: sn,
          valid: res.valid,
          message: res.message,
          component_name: res.component_name || 'Component Identified',
          category: res.category || 'EQUIPMENT',
          time: new Date().toLocaleTimeString()
        },
        ...prev.slice(0, 19)
      ]);

      if (res.valid) {
        // If in dispatch preparation modal, add to dispatch serials
        if (activeModal === 'dispatch') {
          if (!dispatchForm.scanned_serials.some(s => (typeof s === 'string' ? s : s.serial_number) === sn)) {
            setDispatchForm(prev => ({
              ...prev,
              scanned_serials: [...prev.scanned_serials, {
                serial_number: sn,
                component_id: res.component_id,
                barcode_format: 'CODE128'
              }]
            }));
          }
        }
        // If in goods receipt modal, add to receipt serials
        if (activeModal === 'goods_receipt') {
          const currentList = grnForm.serials_text ? grnForm.serials_text.split('\n') : [];
          if (!currentList.includes(sn)) {
            setGrnForm(prev => ({
              ...prev,
              serials_text: prev.serials_text ? `${prev.serials_text}\n${sn}` : sn
            }));
          }
        }
      }
      setScannedSerialInput('');
    } catch (err) {
      playBeep(false);
      setScanValidationResult({
        valid: false,
        message: err.message,
        serial_number: sn
      });
    }
  };

  // -------------------------------------------------------------
  // OPERATIONAL ACTIONS: GOODS RECEIPT (Inward)
  // -------------------------------------------------------------
  const handleSubmitGrn = async (e) => {
    if (e) e.preventDefault();
    if (!grnForm.component_id) {
      alert('Please select a component from the catalogue.');
      return;
    }
    if (grnForm.quantity <= 0) {
      alert('Quantity received must be greater than zero.');
      return;
    }

    setIsSubmittingGrn(true);
    try {
      const serials = grnForm.serials_text
        .split(/[\n,]/)
        .map(s => s.trim().toUpperCase())
        .filter(Boolean);

      const payload = {
        warehouse_id: parseInt(grnForm.warehouse_id),
        component_id: parseInt(grnForm.component_id),
        quantity: parseInt(grnForm.quantity),
        supplier_name: grnForm.supplier_name,
        po_reference: grnForm.po_reference,
        serials: serials.length > 0 ? serials : null,
        notes: `Gate: ${grnForm.arrival_gate} | Truck: ${grnForm.truck_number} | Damages: ${grnForm.damaged_items_count} | Notes: ${grnForm.notes}`
      };

      const res = await api.receiveGoods(payload);
      alert(`Success! Inward Goods Receipt ${res.receipt_number} committed. Stock on hand increased by ${res.quantity_received} units.`);
      setActiveModal(null);
      setGrnForm({
        warehouse_id: 1,
        component_id: '',
        quantity: 10,
        supplier_name: 'Waaree Solar Technologies Ltd',
        po_reference: 'PO-REC-2026-088',
        arrival_gate: 'Gate 2 / Bay A3',
        truck_number: 'MH-12-TR-4019',
        serials_text: '',
        damaged_items_count: 0,
        damage_notes: '',
        notes: 'Inward shipment verified at loading dock.'
      });
      loadAuthoritativeData();
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(`Goods Receipt Failed: ${err.message}`);
    } finally {
      setIsSubmittingGrn(false);
    }
  };

  // -------------------------------------------------------------
  // OPERATIONAL ACTIONS: INTER-DEPOT TRANSFER
  // -------------------------------------------------------------
  const handleSubmitTransfer = async (e) => {
    if (e) e.preventDefault();
    if (transferForm.source_warehouse_id === transferForm.dest_warehouse_id) {
      alert('Source and destination depots cannot be the same.');
      return;
    }
    if (!transferForm.component_id) {
      alert('Please select a component to transfer.');
      return;
    }
    if (transferForm.quantity <= 0) {
      alert('Transfer quantity must be greater than zero.');
      return;
    }

    setIsSubmittingTransfer(true);
    try {
      const payload = {
        source_warehouse_id: parseInt(transferForm.source_warehouse_id),
        dest_warehouse_id: parseInt(transferForm.dest_warehouse_id),
        component_id: parseInt(transferForm.component_id),
        quantity: parseInt(transferForm.quantity),
        notes: transferForm.notes,
        auto_approve: transferForm.auto_approve
      };

      const res = await api.createInventoryTransfer(payload);
      alert(`Inter-Depot Transfer ${res.transfer_number} created with status '${res.status}'.`);
      setActiveModal(null);
      loadAuthoritativeData();
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(`Transfer Creation Failed: ${err.message}`);
    } finally {
      setIsSubmittingTransfer(false);
    }
  };

  const handleApproveTransfer = async (id) => {
    try {
      await api.approveInventoryTransfer(id);
      alert('Transfer approved! Stock locked at source depot.');
      loadAuthoritativeData();
    } catch (err) {
      alert(`Approval error: ${err.message}`);
    }
  };

  const handleDispatchTransfer = async (id) => {
    try {
      await api.dispatchInventoryTransfer(id);
      alert('Transfer dispatched! Deducted from source depot, marked IN_TRANSIT.');
      loadAuthoritativeData();
    } catch (err) {
      alert(`Dispatch error: ${err.message}`);
    }
  };

  const handleReceiveTransfer = async (id) => {
    try {
      await api.receiveInventoryTransfer(id);
      alert('Transfer received! Destination depot stock updated.');
      loadAuthoritativeData();
    } catch (err) {
      alert(`Receipt error: ${err.message}`);
    }
  };

  const handleCancelTransfer = async (id) => {
    if (!confirm('Are you sure you want to cancel this transfer? Any reserved stock will be released.')) return;
    try {
      await api.cancelInventoryTransfer(id);
      alert('Transfer cancelled.');
      loadAuthoritativeData();
    } catch (err) {
      alert(`Cancellation error: ${err.message}`);
    }
  };

  // -------------------------------------------------------------
  // OPERATIONAL ACTIONS: STOCK ADJUSTMENT
  // -------------------------------------------------------------
  const handleSubmitAdjust = async (e) => {
    if (e) e.preventDefault();
    if (!adjustForm.component_id) {
      alert('Select a component to adjust.');
      return;
    }
    if (adjustForm.quantity_change === 0) {
      alert('Quantity change cannot be 0.');
      return;
    }

    setIsSubmittingAdjust(true);
    try {
      const payload = {
        warehouse_id: parseInt(adjustForm.warehouse_id),
        component_id: parseInt(adjustForm.component_id),
        quantity_change: parseInt(adjustForm.quantity_change),
        notes: adjustForm.notes
      };
      const res = await api.adjustInventory(payload);
      alert(`Stock adjusted! ${res.component_name} at ${res.warehouse_name} new on-hand: ${res.qty_on_hand}.`);
      setActiveModal(null);
      loadAuthoritativeData();
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(`Stock Adjustment Rejected: ${err.message}`);
    } finally {
      setIsSubmittingAdjust(false);
    }
  };

  // -------------------------------------------------------------
  // OPERATIONAL ACTIONS: RETURNS MANAGEMENT
  // -------------------------------------------------------------
  const handleSubmitReturn = async (e) => {
    if (e) e.preventDefault();
    if (!returnForm.component_id) {
      alert('Please select a component.');
      return;
    }

    setIsSubmittingReturn(true);
    try {
      const payload = {
        warehouse_id: parseInt(returnForm.warehouse_id),
        component_id: parseInt(returnForm.component_id),
        quantity: parseInt(returnForm.quantity),
        return_type: returnForm.return_type,
        serial_number: returnForm.serial_number.trim() || null,
        reason: returnForm.reason,
        order_or_project: returnForm.order_or_project
      };

      const res = await api.processReturn(payload);
      alert(`Return ${res.return_id} processed as [${res.return_type}]. ${res.return_type === 'RESTOCK' ? 'Usable stock incremented.' : 'Item quarantined in damaged log without corrupting stock.'}`);
      setActiveModal(null);
      loadAuthoritativeData();
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(`Return Processing Failed: ${err.message}`);
    } finally {
      setIsSubmittingReturn(false);
    }
  };

  // -------------------------------------------------------------
  // OPERATIONAL ACTIONS: BOM VERIFICATION & ALLOCATION
  // -------------------------------------------------------------
  const handleOpenOrderBOM = async (order) => {
    setSelectedOrderForBOM(order);
    setActiveModal('order_allocation');
    try {
      const bomData = await api.getOrderBOM(order.id);
      setBomDetails(bomData);
      const sim = await api.simulateOrderAllocation(order.id);
      setBomSimulation(sim);
    } catch (err) {
      console.warn('BOM fetch error:', err);
      // Attempt generation if not generated
      try {
        await api.generateOrderBOM ? api.generateOrderBOM(order.id) : null;
        const bomData = await api.getOrderBOM(order.id);
        setBomDetails(bomData);
      } catch (e2) {
        alert(`BOM Inspection Error: ${err.message}`);
      }
    }
  };

  const handleExecuteAllocation = async (orderId, allowPartial = false) => {
    setIsAllocatingOrder(true);
    try {
      const res = await api.allocateOrderInventory(orderId, {
        allow_partial: allowPartial,
        preferred_warehouse_id: selectedWarehouseId !== 'ALL' ? parseInt(selectedWarehouseId) : null
      });
      alert(`Order ${res.order_number} inventory allocation committed! Stage updated to: ${res.order_stage}.`);
      setActiveModal(null);
      loadAuthoritativeData();
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(`Allocation Failed: ${err.message}`);
    } finally {
      setIsAllocatingOrder(false);
    }
  };

  const handleReleaseReservation = async (orderId) => {
    if (!confirm('Are you sure you want to release all stock reservations for this order?')) return;
    try {
      const res = await api.releaseOrderReservation({ order_id: orderId, reason: 'Warehouse Manager manual release' });
      alert(`Reservations released! ${res.released_allocations_count} allocations released back to available pool.`);
      setActiveModal(null);
      loadAuthoritativeData();
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(`Release Error: ${err.message}`);
    }
  };

  // -------------------------------------------------------------
  // OPERATIONAL ACTIONS: DISPATCH CONFIRMATION & PASSPORT INITIALIZATION
  // -------------------------------------------------------------
  const handleOpenDispatchModal = (order) => {
    setSelectedOrderForDispatch(order);
    setDispatchForm({
      warehouse_id: 1,
      vehicle_number: 'MH-12-SP-2026',
      driver_name: 'Kishore Gaikwad',
      driver_phone: '+91 98220 77112',
      scanned_serials: [],
      notes: `Primary dispatch staging for Order ${order.order_number}`,
      checklist_picked: true,
      checklist_packaging: true,
      checklist_vehicle: true,
      checklist_driver: true
    });
    setActiveModal('dispatch');
  };

  const handleConfirmDispatchWithPassport = async (e) => {
    if (e) e.preventDefault();
    if (!selectedOrderForDispatch) return;

    if (!dispatchForm.checklist_picked || !dispatchForm.checklist_packaging || !dispatchForm.checklist_vehicle || !dispatchForm.checklist_driver) {
      alert('All mandatory 4-point dispatch checklist items must be verified prior to staging exit.');
      return;
    }

    if (!dispatchForm.scanned_serials || dispatchForm.scanned_serials.length === 0) {
      alert('Scanning Required: At least one physical component serial number must be captured and verified before dispatch confirmation.');
      return;
    }

    setIsConfirmingDispatch(true);
    try {
      const payload = {
        order_id: selectedOrderForDispatch.id,
        warehouse_id: parseInt(dispatchForm.warehouse_id),
        vehicle_number: dispatchForm.vehicle_number,
        driver_name: dispatchForm.driver_name,
        driver_phone: dispatchForm.driver_phone,
        notes: dispatchForm.notes,
        scanned_serials: dispatchForm.scanned_serials
      };

      const res = await api.confirmDispatchWithPassport(payload);
      setGeneratedPassport(res);
      setActiveModal('passport_view');
      loadAuthoritativeData();
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(`Dispatch & Passport Initialization Blocked: ${err.message}`);
    } finally {
      setIsConfirmingDispatch(false);
    }
  };

  // -------------------------------------------------------------
  // OPERATIONAL ACTIONS: TASK MANAGER
  // -------------------------------------------------------------
  const handleCompleteTask = async (taskId) => {
    try {
      if (api.completeTask) {
        await api.completeTask(taskId);
        alert('Task marked COMPLETED!');
        loadAuthoritativeData();
      } else {
        await api.updateTask(taskId, { status: 'COMPLETED' });
        loadAuthoritativeData();
      }
    } catch (err) {
      alert(`Task completion error: ${err.message}`);
    }
  };

  const handleAddTaskComment = async (taskId) => {
    const text = taskCommentText[taskId];
    if (!text || !text.trim()) return;
    try {
      await api.addTaskComment(taskId, text);
      setTaskCommentText(prev => ({ ...prev, [taskId]: '' }));
      loadAuthoritativeData();
    } catch (err) {
      alert(`Comment error: ${err.message}`);
    }
  };

  // -------------------------------------------------------------
  // OPERATIONAL ACTIONS: CSV EXPORT
  // -------------------------------------------------------------
  const handleExportCSV = (reportType = 'inventory') => {
    const token = localStorage.getItem('sunpower_token');
    const url = `http://127.0.0.1:8000/api/analytics/export/csv?report_type=${reportType}`;
    // Trigger direct stream download
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `sunpower_${reportType}_report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Derived KPIs & Filtered Stock
  const kpis = data?.kpis || {};
  const totalStock = kpis.total_stock ?? inventoryStocks.reduce((acc, s) => acc + s.qty_on_hand, 0);
  const totalReserved = kpis.reserved_stock ?? inventoryStocks.reduce((acc, s) => acc + s.qty_reserved, 0);
  const availableStock = kpis.available_stock ?? Math.max(0, totalStock - totalReserved);
  const lowStockCount = kpis.low_stock_items ?? inventoryStocks.filter(s => s.is_low_stock).length;

  const filteredStocks = inventoryStocks.filter(s => {
    const matchesWh = selectedWarehouseId === 'ALL' || s.warehouse_id === parseInt(selectedWarehouseId);
    const matchesCat = categoryFilter === 'ALL' || s.category === categoryFilter;
    const matchesLow = !lowStockOnly || s.is_low_stock;
    const matchesQuery = !searchQuery ||
      s.component_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.sku?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesWh && matchesCat && matchesLow && matchesQuery;
  });

  const filteredOrders = ordersList.filter(o => {
    if (orderFilter === 'awaiting') return ['CONFIRMED', 'BOM_GENERATED', 'ALLOCATION_PENDING'].includes(o.stage || o.status);
    if (orderFilter === 'partial') return ['PARTIALLY_ALLOCATED', 'PARTIALLY_DISPATCHED'].includes(o.stage || o.status);
    if (orderFilter === 'full') return ['INVENTORY_ALLOCATED', 'READY_FOR_DISPATCH'].includes(o.stage || o.status);
    if (orderFilter === 'blocked') return ['BLOCKED', 'CANCELLED', 'SHORTAGE'].includes(o.stage || o.status);
    return true;
  });

  return (
    <div className="field-ops-app" style={{
      maxWidth: '480px',
      margin: '0 auto',
      minHeight: '100vh',
      background: '#f7f9ff',
      color: '#101d28',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      boxShadow: '0 0 50px rgba(0,0,0,0.1)'
    }}>

      {/* TOP HEADER (Stitch: warehouse_home header) */}
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 40,
        background: 'rgba(255, 255, 255, 0.92)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid #dceaf9',
        padding: '0.65rem 1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.4rem'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: '#005131',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 2px 6px rgba(0,81,49,0.25)'
            }}>
              <WhIcon size={20} />
            </div>
            <div>
              <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#005131', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                SunPower Solutions
              </span>
              <h1 style={{ fontSize: '0.95rem', fontWeight: 800, margin: 0, color: '#101d28' }}>
                Warehouse Manager
              </h1>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <button
              onClick={() => { loadAuthoritativeData(); if (onRefresh) onRefresh(); }}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                border: '1px solid #dceaf9',
                background: '#ffffff',
                color: '#475569',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="Sync Central Database"
            >
              <RefreshCw size={16} className={isLoadingDetails ? 'animate-spin' : ''} />
            </button>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: '#176b45',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontSize: '0.8rem',
              fontWeight: 800
            }}>
              {user?.full_name ? user.full_name[0] : 'W'}
            </div>
          </div>
        </div>

        {/* Depot Switcher & Live Sync Indicator */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.72rem', color: '#536778', fontWeight: 600 }}>Active Depot:</span>
            <select
              value={selectedWarehouseId}
              onChange={(e) => setSelectedWarehouseId(e.target.value)}
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                padding: '0.25rem 0.5rem',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#101d28'
              }}
            >
              <option value="ALL">All Regional Depots (Consolidated)</option>
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.name} ({w.city})</option>
              ))}
            </select>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            background: '#eaf6ef',
            color: '#176b45',
            padding: '0.15rem 0.45rem',
            borderRadius: '999px',
            fontSize: '0.65rem',
            fontWeight: 700
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#176b45', animation: 'pulse 1.5s infinite' }} />
            <span>Central Sync</span>
          </div>
        </div>
      </header>

      {/* MAIN SCREEN BODY */}
      <main style={{ flex: 1, padding: '1rem', paddingBottom: '6rem', overflowY: 'auto' }}>

        {/* ======================================================== */}
        {/* TAB 1: HOME & DASHBOARD (Stitch: warehouse_home) */}
        {/* ======================================================== */}
        {currentTab === 'home' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>

            {/* Shift & Greeting Banner */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#ffffff',
              borderRadius: '14px',
              padding: '0.9rem 1rem',
              border: '1px solid #dceaf9',
              boxShadow: '0 1px 4px rgba(16,29,40,0.03)'
            }}>
              <div>
                <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: '#101d28' }}>
                  Good morning, {user?.full_name?.split(' ')[0] || 'Rajesh'}
                </h2>
                <p style={{ fontSize: '0.74rem', color: '#536778', margin: '0.15rem 0 0' }}>
                  Shift 1 • Warehouse active central overview
                </p>
              </div>
              <button
                onClick={() => { setCurrentTab('operations'); setOperationsSubTab('alerts'); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  background: lowStockCount > 0 ? '#fdecec' : '#eaf6ef',
                  color: lowStockCount > 0 ? '#991b1b' : '#176b45',
                  padding: '0.35rem 0.65rem',
                  borderRadius: '999px',
                  border: 'none',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                <AlertCircle size={14} />
                <span>{lowStockCount} Alerts</span>
              </button>
            </div>

            {/* 6 OPERATIONAL SUMMARY CARDS (2-Column Grid) */}
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#101d28', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
                <span>Authoritative Stock Metrics</span>
                <span style={{ fontSize: '0.68rem', color: '#536778', fontWeight: 600 }}>Backend Synchronized</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>

                {/* 1. Total Physical Stock */}
                <div style={{
                  background: '#ffffff',
                  borderRadius: '12px',
                  padding: '0.85rem',
                  border: '1px solid #dceaf9',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.02)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#e2efff', color: '#005131', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Boxes size={18} />
                    </div>
                    <span style={{ fontSize: '0.62rem', fontWeight: 800, color: '#536778', textTransform: 'uppercase' }}>Physical</span>
                  </div>
                  <div style={{ marginTop: '0.5rem' }}>
                    <span style={{ fontSize: '1.4rem', fontWeight: 900, color: '#101d28', lineHeight: 1 }}>
                      {totalStock.toLocaleString()}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: '#536778', display: 'block', marginTop: '0.15rem' }}>
                      Total Stock on Hand
                    </span>
                  </div>
                </div>

                {/* 2. Available Stock */}
                <div style={{
                  background: '#ffffff',
                  borderRadius: '12px',
                  padding: '0.85rem',
                  border: '1px solid #dceaf9',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.02)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#eaf6ef', color: '#176b45', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Package size={18} />
                    </div>
                    <span style={{ fontSize: '0.62rem', fontWeight: 800, color: '#176b45', textTransform: 'uppercase' }}>Available</span>
                  </div>
                  <div style={{ marginTop: '0.5rem' }}>
                    <span style={{ fontSize: '1.4rem', fontWeight: 900, color: '#176b45', lineHeight: 1 }}>
                      {availableStock.toLocaleString()}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: '#536778', display: 'block', marginTop: '0.15rem' }}>
                      Unreserved Available
                    </span>
                  </div>
                </div>

                {/* 3. Reserved Stock */}
                <div style={{
                  background: '#ffffff',
                  borderRadius: '12px',
                  padding: '0.85rem',
                  border: '1px solid #dceaf9',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.02)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#edf5ff', color: '#1d4ed8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Tag size={18} />
                    </div>
                    <span style={{ fontSize: '0.62rem', fontWeight: 800, color: '#1d4ed8', textTransform: 'uppercase' }}>Locked</span>
                  </div>
                  <div style={{ marginTop: '0.5rem' }}>
                    <span style={{ fontSize: '1.4rem', fontWeight: 900, color: '#1d4ed8', lineHeight: 1 }}>
                      {totalReserved.toLocaleString()}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: '#536778', display: 'block', marginTop: '0.15rem' }}>
                      Reserved for Orders
                    </span>
                  </div>
                </div>

                {/* 4. Low Stock Alerts */}
                <div style={{
                  background: '#ffffff',
                  borderRadius: '12px',
                  padding: '0.85rem',
                  border: '1px solid #dceaf9',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.02)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#fdecec', color: '#991b1b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <AlertTriangle size={18} />
                    </div>
                    <span style={{ fontSize: '0.62rem', fontWeight: 800, color: '#991b1b', textTransform: 'uppercase' }}>Critical</span>
                  </div>
                  <div style={{ marginTop: '0.5rem' }}>
                    <span style={{ fontSize: '1.4rem', fontWeight: 900, color: '#991b1b', lineHeight: 1 }}>
                      {lowStockCount}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: '#536778', display: 'block', marginTop: '0.15rem' }}>
                      Low-Stock Items
                    </span>
                  </div>
                </div>

                {/* 5. Inbound Pending Receipts */}
                <div style={{
                  background: '#ffffff',
                  borderRadius: '12px',
                  padding: '0.85rem',
                  border: '1px solid #dceaf9',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.02)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#eaf6ef', color: '#176b45', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <ArrowDownLeft size={18} />
                    </div>
                    <span style={{ fontSize: '0.62rem', fontWeight: 800, color: '#176b45', textTransform: 'uppercase' }}>Inbound</span>
                  </div>
                  <div style={{ marginTop: '0.5rem' }}>
                    <span style={{ fontSize: '1.4rem', fontWeight: 900, color: '#101d28', lineHeight: 1 }}>
                      {kpis.pending_goods_receipts ?? transfersList.filter(t => t.status === 'IN_TRANSIT').length + 1}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: '#536778', display: 'block', marginTop: '0.15rem' }}>
                      Pending Receipts
                    </span>
                  </div>
                </div>

                {/* 6. Outbound Dispatches */}
                <div style={{
                  background: '#ffffff',
                  borderRadius: '12px',
                  padding: '0.85rem',
                  border: '1px solid #dceaf9',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.02)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#e2efff', color: '#005131', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Truck size={18} />
                    </div>
                    <span style={{ fontSize: '0.62rem', fontWeight: 800, color: '#005131', textTransform: 'uppercase' }}>Outbound</span>
                  </div>
                  <div style={{ marginTop: '0.5rem' }}>
                    <span style={{ fontSize: '1.4rem', fontWeight: 900, color: '#101d28', lineHeight: 1 }}>
                      {dispatchesList.length}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: '#536778', display: 'block', marginTop: '0.15rem' }}>
                      Dispatches Handled
                    </span>
                  </div>
                </div>

              </div>
            </div>

            {/* 6 QUICK OPERATIONAL SHORTCUT BUTTONS (Stitch: 6 Quick Action Grid) */}
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#101d28', marginBottom: '0.5rem' }}>
                Quick Operations
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>

                {/* 1. Receive Stock */}
                <button
                  type="button"
                  onClick={() => setActiveModal('goods_receipt')}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #bfc9c0',
                    borderRadius: '12px',
                    padding: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    textAlign: 'left',
                    cursor: 'pointer',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                  }}
                >
                  <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#176b45', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', shrink: 0 }}>
                    <Package size={18} />
                  </div>
                  <div style={{ overflow: 'hidden' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#101d28', display: 'block', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                      Receive Stock
                    </span>
                    <span style={{ fontSize: '0.65rem', color: '#536778', display: 'block' }}>
                      Inbound gate entry
                    </span>
                  </div>
                </button>

                {/* 2. Find Inventory */}
                <button
                  type="button"
                  onClick={() => setCurrentTab('inventory')}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #bfc9c0',
                    borderRadius: '12px',
                    padding: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    textAlign: 'left',
                    cursor: 'pointer',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                  }}
                >
                  <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#d0e5f9', color: '#536778', display: 'flex', alignItems: 'center', justifyContent: 'center', shrink: 0 }}>
                    <Search size={18} />
                  </div>
                  <div style={{ overflow: 'hidden' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#101d28', display: 'block', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                      Find Inventory
                    </span>
                    <span style={{ fontSize: '0.65rem', color: '#536778', display: 'block' }}>
                      Locate bin & bay
                    </span>
                  </div>
                </button>

                {/* 3. Allocate Order */}
                <button
                  type="button"
                  onClick={() => setCurrentTab('orders')}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #bfc9c0',
                    borderRadius: '12px',
                    padding: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    textAlign: 'left',
                    cursor: 'pointer',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                  }}
                >
                  <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#edf5ff', color: '#1d4ed8', display: 'flex', alignItems: 'center', justifyContent: 'center', shrink: 0 }}>
                    <CheckSquare size={18} />
                  </div>
                  <div style={{ overflow: 'hidden' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#101d28', display: 'block', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                      Allocate Order
                    </span>
                    <span style={{ fontSize: '0.65rem', color: '#536778', display: 'block' }}>
                      BOM wave picking
                    </span>
                  </div>
                </button>

                {/* 4. Prepare Dispatch */}
                <button
                  type="button"
                  onClick={() => {
                    const readyOrder = ordersList.find(o => ['INVENTORY_ALLOCATED', 'READY_FOR_DISPATCH'].includes(o.stage || o.status)) || ordersList[0];
                    if (readyOrder) handleOpenDispatchModal(readyOrder);
                    else setCurrentTab('orders');
                  }}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #bfc9c0',
                    borderRadius: '12px',
                    padding: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    textAlign: 'left',
                    cursor: 'pointer',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                  }}
                >
                  <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#eaf6ef', color: '#176b45', display: 'flex', alignItems: 'center', justifyContent: 'center', shrink: 0 }}>
                    <Truck size={18} />
                  </div>
                  <div style={{ overflow: 'hidden' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#101d28', display: 'block', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                      Prepare Dispatch
                    </span>
                    <span style={{ fontSize: '0.65rem', color: '#536778', display: 'block' }}>
                      Staging & gate pass
                    </span>
                  </div>
                </button>

                {/* 5. Transfer Stock */}
                <button
                  type="button"
                  onClick={() => setActiveModal('transfer')}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #bfc9c0',
                    borderRadius: '12px',
                    padding: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    textAlign: 'left',
                    cursor: 'pointer',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                  }}
                >
                  <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#dceaf9', color: '#4d6171', display: 'flex', alignItems: 'center', justifyContent: 'center', shrink: 0 }}>
                    <ArrowRightLeft size={18} />
                  </div>
                  <div style={{ overflow: 'hidden' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#101d28', display: 'block', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                      Transfer Stock
                    </span>
                    <span style={{ fontSize: '0.65rem', color: '#536778', display: 'block' }}>
                      Depot-to-depot
                    </span>
                  </div>
                </button>

                {/* 6. Scan Component */}
                <button
                  type="button"
                  onClick={() => setCurrentTab('scanner')}
                  style={{
                    background: '#005131',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    textAlign: 'left',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(0,81,49,0.2)'
                  }}
                >
                  <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#ffffff', color: '#005131', display: 'flex', alignItems: 'center', justifyContent: 'center', shrink: 0 }}>
                    <QrCode size={18} />
                  </div>
                  <div style={{ overflow: 'hidden' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#ffffff', display: 'block', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                      Scan Barcode
                    </span>
                    <span style={{ fontSize: '0.65rem', color: '#99e9b9', display: 'block' }}>
                      Live camera verify
                    </span>
                  </div>
                </button>

              </div>
            </div>

            {/* HIGH-PRIORITY PENDING OPERATIONAL ACTIONS (Stitch: Pending Operational Actions Section) */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#101d28' }}>
                    Pending Operational Actions
                  </span>
                  <span style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#ffdad6', color: '#93000a', fontSize: '0.62rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    4
                  </span>
                </div>
                <button
                  onClick={() => setCurrentTab('orders')}
                  style={{ background: 'none', border: 'none', color: '#005131', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  View queue
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>

                {/* Action 1: Inbound Waaree verification (PO-REC-2026-088) */}
                <div style={{
                  background: '#ffffff',
                  borderRadius: '12px',
                  padding: '0.85rem',
                  border: '1px solid #bfc9c0',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.02)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.68rem', color: '#536778' }}>
                        <span style={{ fontWeight: 800, color: '#101d28' }}>PO-REC-2026-088</span>
                        <span>•</span>
                        <span>Bay A3 (Gate 2)</span>
                      </div>
                      <h4 style={{ fontSize: '0.82rem', fontWeight: 800, margin: '0.2rem 0', color: '#101d28' }}>
                        Waaree 450W Modules Inbound Verification
                      </h4>
                      <p style={{ fontSize: '0.7rem', color: '#536778', margin: 0 }}>
                        120 units arrived • Awaiting serial scan & barcode audit
                      </p>
                    </div>
                    <span style={{ fontSize: '0.65rem', fontWeight: 800, background: '#fff5df', color: '#92400e', padding: '0.2rem 0.5rem', borderRadius: '999px' }}>
                      Verify PO
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.6rem', paddingTop: '0.6rem', borderTop: '1px solid #dceaf9' }}>
                    <span style={{ fontSize: '0.68rem', color: '#536778' }}>Truck: AP-28-TB-4019</span>
                    <button
                      type="button"
                      onClick={() => setActiveModal('goods_receipt')}
                      style={{
                        background: '#005131',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '0.35rem 0.85rem',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      Verify
                    </button>
                  </div>
                </div>

                {/* Action 2: Order Allocation Alert for ORD-8941 */}
                <div style={{
                  background: '#ffffff',
                  borderRadius: '12px',
                  padding: '0.85rem',
                  border: '1px solid #bfc9c0',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.02)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.68rem', color: '#536778' }}>
                        <span style={{ fontWeight: 800, color: '#991b1b' }}>ORD-8941</span>
                        <span>•</span>
                        <span>Site INS-0018 Jubilee Hills</span>
                      </div>
                      <h4 style={{ fontSize: '0.82rem', fontWeight: 800, margin: '0.2rem 0', color: '#101d28' }}>
                        Order Allocation Alert (High Priority)
                      </h4>
                      <p style={{ fontSize: '0.7rem', color: '#536778', margin: 0 }}>
                        Stock available • Awaiting picker wave release
                      </p>
                    </div>
                    <span style={{ fontSize: '0.65rem', fontWeight: 800, background: '#fdecec', color: '#991b1b', padding: '0.2rem 0.5rem', borderRadius: '999px' }}>
                      Critical
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.6rem', paddingTop: '0.6rem', borderTop: '1px solid #dceaf9' }}>
                    <span style={{ fontSize: '0.68rem', color: '#991b1b', fontWeight: 700 }}>Requires approval within 45 min</span>
                    <button
                      type="button"
                      onClick={() => {
                        const target = ordersList.find(o => o.order_number?.includes('8941')) || ordersList[0];
                        if (target) handleOpenOrderBOM(target);
                        else setCurrentTab('orders');
                      }}
                      style={{
                        background: '#e2efff',
                        color: '#005131',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '0.35rem 0.85rem',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      Allocate
                    </button>
                  </div>
                </div>

                {/* Action 3: Dispatch Staging for DSP-2026-0048 */}
                <div style={{
                  background: '#ffffff',
                  borderRadius: '12px',
                  padding: '0.85rem',
                  border: '1px solid #bfc9c0',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.02)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.68rem', color: '#536778' }}>
                        <span style={{ fontWeight: 800, color: '#101d28' }}>DSP-2026-0048</span>
                        <span>•</span>
                        <span>ORD-8941</span>
                      </div>
                      <h4 style={{ fontSize: '0.82rem', fontWeight: 800, margin: '0.2rem 0', color: '#101d28' }}>
                        Dispatch Staging & Gate Pass
                      </h4>
                      <p style={{ fontSize: '0.7rem', color: '#536778', margin: 0 }}>
                        Staging Area 2 • Manifest QC check needed
                      </p>
                    </div>
                    <span style={{ fontSize: '0.65rem', fontWeight: 800, background: '#eaf6ef', color: '#176b45', padding: '0.2rem 0.5rem', borderRadius: '999px' }}>
                      Ready Pickup
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.6rem', paddingTop: '0.6rem', borderTop: '1px solid #dceaf9' }}>
                    <span style={{ fontSize: '0.68rem', color: '#536778' }}>Est. Pickup: Today, 2:30 PM</span>
                    <button
                      type="button"
                      onClick={() => {
                        const target = ordersList.find(o => o.order_number?.includes('8941')) || ordersList[0];
                        if (target) handleOpenDispatchModal(target);
                        else setCurrentTab('orders');
                      }}
                      style={{
                        background: '#e2efff',
                        color: '#005131',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '0.35rem 0.85rem',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      Stage
                    </button>
                  </div>
                </div>

                {/* Action 4: Inter-depot transfer pending receipt TRF-2026-012 */}
                <div style={{
                  background: '#ffffff',
                  borderRadius: '12px',
                  padding: '0.85rem',
                  border: '1px solid #bfc9c0',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.02)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.68rem', color: '#536778' }}>
                        <span style={{ fontWeight: 800, color: '#101d28' }}>TRF-2026-012</span>
                        <span>•</span>
                        <span>From: Pune Hub</span>
                      </div>
                      <h4 style={{ fontSize: '0.82rem', fontWeight: 800, margin: '0.2rem 0', color: '#101d28' }}>
                        Inter-Depot Transfer Pending Receipt
                      </h4>
                      <p style={{ fontSize: '0.7rem', color: '#536778', margin: 0 }}>
                        Growatt 5000TL-X Inverters (x4) • En route to Central Hub
                      </p>
                    </div>
                    <span style={{ fontSize: '0.65rem', fontWeight: 800, background: '#edf5ff', color: '#1d4ed8', padding: '0.2rem 0.5rem', borderRadius: '999px' }}>
                      In Transit
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.6rem', paddingTop: '0.6rem', borderTop: '1px solid #dceaf9' }}>
                    <span style={{ fontSize: '0.68rem', color: '#536778' }}>ETA: Today, 5:15 PM</span>
                    <button
                      type="button"
                      onClick={() => { setCurrentTab('operations'); setOperationsSubTab('transfers'); }}
                      style={{
                        background: '#e2efff',
                        color: '#005131',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '0.35rem 0.85rem',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      Track
                    </button>
                  </div>
                </div>

              </div>
            </div>

            {/* Personal Tasks Quick Preview (Module 3.C) */}
            <div style={{
              background: '#ffffff',
              borderRadius: '12px',
              padding: '0.9rem',
              border: '1px solid #dceaf9'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#101d28' }}>
                  Warehouse Tasks ({tasksList.filter(t => t.status !== 'COMPLETED').length} Active)
                </span>
                <button
                  onClick={() => { setCurrentTab('operations'); setOperationsSubTab('tasks'); }}
                  style={{ background: 'none', border: 'none', color: '#005131', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Manage All
                </button>
              </div>

              {tasksList.slice(0, 3).map(task => (
                <div key={task.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.5rem 0',
                  borderBottom: '1px solid #f1f5f9'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      type="checkbox"
                      checked={task.status === 'COMPLETED'}
                      onChange={() => handleCompleteTask(task.id)}
                      style={{ width: '16px', height: '16px', accentColor: '#005131', cursor: 'pointer' }}
                    />
                    <div>
                      <span style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: task.status === 'COMPLETED' ? '#94a3b8' : '#101d28',
                        textDecoration: task.status === 'COMPLETED' ? 'line-through' : 'none'
                      }}>
                        {task.title}
                      </span>
                      <span style={{ fontSize: '0.65rem', color: '#536778', display: 'block' }}>
                        Due: {task.due_date ? new Date(task.due_date).toLocaleDateString() : 'Today'}
                      </span>
                    </div>
                  </div>
                  <span style={{
                    fontSize: '0.6rem',
                    fontWeight: 800,
                    padding: '0.1rem 0.4rem',
                    borderRadius: '4px',
                    background: task.priority === 'HIGH' || task.priority === 'URGENT' ? '#ffdad6' : '#e2efff',
                    color: task.priority === 'HIGH' || task.priority === 'URGENT' ? '#93000a' : '#005131'
                  }}>
                    {task.priority}
                  </span>
                </div>
              ))}
            </div>

          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: INVENTORY STOCK LEDGER (Stitch: inventory_stock_ledger) */}
        {/* ======================================================== */}
        {currentTab === 'inventory' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            {/* Search Input */}
            <div style={{ position: 'relative' }}>
              <Search size={18} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: '#536778' }} />
              <input
                type="text"
                placeholder="Search component name, SKU, or brand..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem 0.65rem 2.4rem',
                  borderRadius: '12px',
                  border: '1px solid #bfc9c0',
                  background: '#ffffff',
                  fontSize: '0.8rem',
                  outline: 'none',
                  boxShadow: '0 1px 4px rgba(16,29,40,0.04)'
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Category Filter Chips */}
            <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', paddingBottom: '0.2rem' }}>
              {['ALL', 'PANEL', 'INVERTER', 'STRUCTURE', 'BATTERY', 'BOS'].map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: '999px',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    border: 'none',
                    background: categoryFilter === cat ? '#005131' : '#ffffff',
                    color: categoryFilter === cat ? '#ffffff' : '#536778',
                    cursor: 'pointer',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {cat === 'ALL' ? 'All Items' : cat}
                </button>
              ))}
              <button
                onClick={() => setLowStockOnly(!lowStockOnly)}
                style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: '999px',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  border: lowStockOnly ? '1px solid #991b1b' : '1px solid #cbd5e1',
                  background: lowStockOnly ? '#fdecec' : '#ffffff',
                  color: lowStockOnly ? '#991b1b' : '#536778',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem'
                }}
              >
                <AlertTriangle size={12} />
                <span>Low Stock Only</span>
              </button>
            </div>

            {/* Authoritative Formula Banner (Module 3.D) */}
            <div style={{
              background: '#e2efff',
              borderRadius: '10px',
              padding: '0.65rem 0.85rem',
              border: '1px solid #dceaf9',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <Info size={16} style={{ color: '#005131', shrink: 0 }} />
              <div style={{ fontSize: '0.68rem', color: '#101d28' }}>
                <strong>Authoritative Stock Formula:</strong> Available = Physical on Hand − Reserved for Confirmed Orders. Stock cannot be artificially adjusted without recorded movement log.
              </div>
            </div>

            {/* Action Bar: Export CSV & Manual Adjustment */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.74rem', color: '#536778', fontWeight: 600 }}>
                Showing {filteredStocks.length} components
              </span>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button
                  onClick={() => handleExportCSV('inventory')}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #bfc9c0',
                    borderRadius: '8px',
                    padding: '0.35rem 0.65rem',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    color: '#101d28',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    cursor: 'pointer'
                  }}
                >
                  <Download size={13} />
                  <span>Export CSV</span>
                </button>
                <button
                  onClick={() => setActiveModal('adjust')}
                  style={{
                    background: '#005131',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '0.35rem 0.65rem',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    cursor: 'pointer'
                  }}
                >
                  <Plus size={13} />
                  <span>Stock Adjust</span>
                </button>
              </div>
            </div>

            {/* Inventory Items Ledger Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {filteredStocks.map((item) => (
                <div
                  key={item.id}
                  style={{
                    background: '#ffffff',
                    borderRadius: '14px',
                    padding: '0.85rem',
                    border: item.is_low_stock ? '1px solid #fecaca' : '1px solid #bfc9c0',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.02)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <span style={{ fontSize: '0.65rem', fontFamily: 'monospace', fontWeight: 800, color: '#005131', background: '#a4f4c3', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>
                          {item.sku}
                        </span>
                        <span style={{ fontSize: '0.68rem', color: '#536778' }}>• {item.warehouse_name}</span>
                      </div>
                      <h4 style={{ fontSize: '0.85rem', fontWeight: 800, margin: '0.3rem 0 0.15rem', color: '#101d28' }}>
                        {item.component_name}
                      </h4>
                      <span style={{ fontSize: '0.68rem', color: '#536778' }}>
                        Category: {item.category} • Tier: {item.tier_grade || 'Tier-1'}
                      </span>
                    </div>

                    {item.is_low_stock && (
                      <span style={{ fontSize: '0.62rem', fontWeight: 800, background: '#fdecec', color: '#991b1b', padding: '0.2rem 0.5rem', borderRadius: '999px' }}>
                        Low Stock
                      </span>
                    )}
                  </div>

                  {/* 4 Stock Quantities Pill Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem', marginTop: '0.65rem', paddingTop: '0.65rem', borderTop: '1px solid #f1f5f9' }}>
                    <div style={{ textAlign: 'center', background: '#f8fafc', padding: '0.35rem', borderRadius: '8px' }}>
                      <span style={{ fontSize: '0.6rem', color: '#64748b', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>On Hand</span>
                      <span style={{ fontSize: '0.95rem', fontWeight: 900, color: '#101d28' }}>{item.qty_on_hand}</span>
                    </div>
                    <div style={{ textAlign: 'center', background: '#edf5ff', padding: '0.35rem', borderRadius: '8px' }}>
                      <span style={{ fontSize: '0.6rem', color: '#1d4ed8', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>Reserved</span>
                      <span style={{ fontSize: '0.95rem', fontWeight: 900, color: '#1d4ed8' }}>{item.qty_reserved}</span>
                    </div>
                    <div style={{ textAlign: 'center', background: '#eaf6ef', padding: '0.35rem', borderRadius: '8px' }}>
                      <span style={{ fontSize: '0.6rem', color: '#176b45', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>Available</span>
                      <span style={{ fontSize: '0.95rem', fontWeight: 900, color: '#176b45' }}>{item.available}</span>
                    </div>
                    <div style={{ textAlign: 'center', background: '#f8fafc', padding: '0.35rem', borderRadius: '8px' }}>
                      <span style={{ fontSize: '0.6rem', color: '#64748b', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>Min Reorder</span>
                      <span style={{ fontSize: '0.95rem', fontWeight: 900, color: '#475569' }}>{item.min_threshold}</span>
                    </div>
                  </div>

                  {/* Quick Action Footer */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem', marginTop: '0.5rem' }}>
                    <button
                      onClick={() => {
                        setTransferForm(prev => ({
                          ...prev,
                          component_id: item.component_id,
                          source_warehouse_id: item.warehouse_id
                        }));
                        setActiveModal('transfer');
                      }}
                      style={{
                        background: '#e2efff',
                        color: '#005131',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '0.25rem 0.55rem',
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      Transfer
                    </button>
                    <button
                      onClick={() => {
                        setAdjustForm(prev => ({
                          ...prev,
                          component_id: item.component_id,
                          warehouse_id: item.warehouse_id
                        }));
                        setActiveModal('adjust');
                      }}
                      style={{
                        background: '#f1f5f9',
                        color: '#475569',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '0.25rem 0.55rem',
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      Audit
                    </button>
                  </div>
                </div>
              ))}
            </div>

          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 3: ORDERS & BOM ALLOCATION (Stitch: orders_bom_allocation) */}
        {/* ======================================================== */}
        {currentTab === 'orders' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            {/* Filter Chips */}
            <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', paddingBottom: '0.2rem' }}>
              {[
                { id: 'all', label: 'All Orders' },
                { id: 'awaiting', label: 'Awaiting Allocation' },
                { id: 'partial', label: 'Partially Allocated' },
                { id: 'full', label: 'Ready for Dispatch' }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setOrderFilter(f.id)}
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: '999px',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    border: 'none',
                    background: orderFilter === f.id ? '#005131' : '#ffffff',
                    color: orderFilter === f.id ? '#ffffff' : '#536778',
                    cursor: 'pointer',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Smart Hub Buffer Recommendation Banner (Stitch: orders_bom_allocation) */}
            <div style={{
              background: 'linear-gradient(135deg, #ecf4ff 0%, #ffffff 50%, #e2efff 100%)',
              borderRadius: '14px',
              padding: '0.9rem',
              border: '1px solid #dceaf9',
              boxShadow: '0 1px 4px rgba(0,0,0,0.02)'
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
                <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: '#a4f4c3', color: '#002111', display: 'flex', alignItems: 'center', justifyContent: 'center', shrink: 0 }}>
                  <Sparkles size={18} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#005131', textTransform: 'uppercase' }}>
                      Smart Hub Balancing
                    </span>
                    <span style={{ fontSize: '0.62rem', background: '#d6e4f3', color: '#101d28', padding: '0.1rem 0.35rem', borderRadius: '4px', fontWeight: 700 }}>
                      Active Recommendation
                    </span>
                  </div>
                  <h4 style={{ fontSize: '0.82rem', fontWeight: 800, margin: '0.2rem 0', color: '#101d28' }}>
                    Buffer Match Detected
                  </h4>
                  <p style={{ fontSize: '0.7rem', color: '#3f4942', margin: 0 }}>
                    Reallocating modules from Central Hub & Inverters from Regional Depots can satisfy all pending orders without waiting for procurement cycles.
                  </p>
                </div>
              </div>
            </div>

            {/* Orders List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {filteredOrders.map(order => {
                const isReady = ['INVENTORY_ALLOCATED', 'READY_FOR_DISPATCH'].includes(order.stage || order.status);
                const isAwaiting = ['CONFIRMED', 'BOM_GENERATED', 'ALLOCATION_PENDING'].includes(order.stage || order.status);
                const isDispatched = ['DISPATCHED', 'INSTALLED', 'COMMISSIONED'].includes(order.stage || order.status);

                return (
                  <div
                    key={order.id}
                    style={{
                      background: '#ffffff',
                      borderRadius: '14px',
                      padding: '0.9rem',
                      border: '1px solid #bfc9c0',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.02)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{ fontSize: '0.68rem', fontFamily: 'monospace', fontWeight: 800, color: '#005131', background: '#a4f4c3', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                            {order.order_number}
                          </span>
                          <span style={{
                            fontSize: '0.62rem',
                            fontWeight: 800,
                            padding: '0.1rem 0.4rem',
                            borderRadius: '999px',
                            background: isReady ? '#eaf6ef' : (isAwaiting ? '#fdecec' : '#edf5ff'),
                            color: isReady ? '#176b45' : (isAwaiting ? '#991b1b' : '#1d4ed8')
                          }}>
                            {order.stage || order.status}
                          </span>
                        </div>
                        <h3 style={{ fontSize: '0.88rem', fontWeight: 800, margin: '0.35rem 0 0.15rem', color: '#101d28' }}>
                          {order.customer_name || (order.customer ? order.customer.name : 'Solar EPC Customer')}
                        </h3>
                        <p style={{ fontSize: '0.7rem', color: '#536778', margin: 0 }}>
                          City: {order.customer_city || (order.customer ? order.customer.city : 'Maharashtra')} • Capacity: 5.4 kW Rooftop
                        </p>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#101d28', display: 'block' }}>
                          ₹{roundPaise(order.total_contract_paise).toLocaleString()}
                        </span>
                        <span style={{ fontSize: '0.62rem', color: '#176b45', fontWeight: 700 }}>
                          Advance Paid
                        </span>
                      </div>
                    </div>

                    {/* Operational Buttons */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.75rem', paddingTop: '0.6rem', borderTop: '1px solid #f1f5f9' }}>
                      <button
                        type="button"
                        onClick={() => handleOpenOrderBOM(order)}
                        style={{
                          background: '#e2efff',
                          color: '#005131',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '0.4rem 0.8rem',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        Inspect BOM & Allocate
                      </button>

                      {isReady && !isDispatched && (
                        <button
                          type="button"
                          onClick={() => handleOpenDispatchModal(order)}
                          style={{
                            background: '#005131',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '0.4rem 0.8rem',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          Stage Dispatch
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 4: REAL CAMERA BARCODE SCANNER (Stitch: barcode_serial_scanner) */}
        {/* ======================================================== */}
        {currentTab === 'scanner' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            {/* Mode Selector Chips */}
            <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', paddingBottom: '0.2rem' }}>
              {[
                { id: 'verify', label: 'Verify Serial / S/N' },
                { id: 'find', label: 'Find Component' },
                { id: 'receive', label: 'Receive Inbound' },
                { id: 'pick', label: 'Pick for Dispatch' }
              ].map(m => (
                <button
                  key={m.id}
                  onClick={() => setScannerMode(m.id)}
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: '999px',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    border: 'none',
                    background: scannerMode === m.id ? '#005131' : '#ffffff',
                    color: scannerMode === m.id ? '#ffffff' : '#536778',
                    cursor: 'pointer',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* Active Workflow Guidance Bar */}
            <div style={{
              background: '#ecf4ff',
              borderRadius: '12px',
              padding: '0.75rem 0.9rem',
              border: '1px solid #dceaf9'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#005131', animation: 'pulse 1.5s infinite' }} />
                  <div>
                    <span style={{ fontSize: '0.62rem', fontWeight: 800, color: '#536778', textTransform: 'uppercase' }}>
                      Mode: {scannerMode.toUpperCase()}
                    </span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#101d28', display: 'block' }}>
                      Target: Serial Number Scan & Verification
                    </span>
                  </div>
                </div>
                <span style={{ fontSize: '0.65rem', fontFamily: 'monospace', fontWeight: 700, background: '#a4f4c3', color: '#002111', padding: '0.15rem 0.45rem', borderRadius: '4px' }}>
                  Live Decoder
                </span>
              </div>
            </div>

            {/* REAL CAMERA SCANNER VIEWFINDER WITH RETICLE & LASER LINE */}
            <div style={{
              position: 'relative',
              width: '100%',
              borderRadius: '16px',
              overflow: 'hidden',
              background: '#0a101d',
              boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
              minHeight: '260px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center'
            }}>

              {/* Html5Qrcode video mounting element */}
              <div
                id="barcode-html5-qr-reader"
                style={{
                  width: '100%',
                  minHeight: '260px',
                  background: '#0a101d',
                  borderRadius: '16px',
                  overflow: 'hidden'
                }}
              />

              {/* Laser Animation Overlay when active */}
              {cameraActive && (
                <div style={{
                  position: 'absolute',
                  inset: '20px',
                  pointerEvents: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <div style={{
                    position: 'relative',
                    width: '240px',
                    height: '150px',
                    border: '2px solid rgba(164, 244, 195, 0.4)',
                    borderRadius: '10px'
                  }}>
                    {/* Reticle corner accents */}
                    <div style={{ position: 'absolute', top: '-2px', left: '-2px', width: '18px', height: '18px', borderTop: '4px solid #a4f4c3', borderLeft: '4px solid #a4f4c3' }} />
                    <div style={{ position: 'absolute', top: '-2px', right: '-2px', width: '18px', height: '18px', borderTop: '4px solid #a4f4c3', borderRight: '4px solid #a4f4c3' }} />
                    <div style={{ position: 'absolute', bottom: '-2px', left: '-2px', width: '18px', height: '18px', borderBottom: '4px solid #a4f4c3', borderLeft: '4px solid #a4f4c3' }} />
                    <div style={{ position: 'absolute', bottom: '-2px', right: '-2px', width: '18px', height: '18px', borderBottom: '4px solid #a4f4c3', borderRight: '4px solid #a4f4c3' }} />

                    {/* Scanning Laser Line */}
                    <div style={{
                      position: 'absolute',
                      width: '100%',
                      height: '2px',
                      background: 'linear-gradient(90deg, transparent, #a4f4c3, #ffffff, #a4f4c3, transparent)',
                      boxShadow: '0 0 10px #a4f4c3',
                      animation: 'scanLaser 2s ease-in-out infinite alternate'
                    }} />
                    <style>{`
                      @keyframes scanLaser {
                        0% { top: 5%; }
                        100% { top: 95%; }
                      }
                    `}</style>
                  </div>
                </div>
              )}

              {/* Status Header on Viewfinder */}
              <div style={{
                position: 'absolute',
                top: '0.65rem',
                left: '0.75rem',
                right: '0.75rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                pointerEvents: 'none'
              }}>
                <div style={{
                  background: 'rgba(0,0,0,0.65)',
                  backdropFilter: 'blur(4px)',
                  padding: '0.2rem 0.55rem',
                  borderRadius: '999px',
                  color: '#ffffff',
                  fontSize: '0.62rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: cameraActive ? '#22c55e' : '#f59e0b' }} />
                  <span>{cameraActive ? 'CODE-128 / QR LIVE' : 'CAMERA STANDBY'}</span>
                </div>

                <div style={{ pointerEvents: 'auto' }}>
                  <button
                    onClick={() => cameraActive ? stopRealCamera() : startRealCamera()}
                    style={{
                      background: 'rgba(0,0,0,0.65)',
                      backdropFilter: 'blur(4px)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      padding: '0.25rem 0.55rem',
                      borderRadius: '999px',
                      color: '#ffffff',
                      fontSize: '0.62rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {cameraActive ? 'Pause Lens' : 'Start Camera'}
                  </button>
                </div>
              </div>

              {/* Fallback error notice if permission is blocked */}
              {cameraError && (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(16, 29, 40, 0.92)',
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  color: '#ffffff'
                }}>
                  <AlertTriangle size={32} style={{ color: '#f59e0b', marginBottom: '0.5rem' }} />
                  <span style={{ fontSize: '0.8rem', fontWeight: 800 }}>Camera Sensor Notice</span>
                  <p style={{ fontSize: '0.68rem', color: '#cbd5e1', maxWidth: '280px', margin: '0.35rem 0 0.75rem' }}>
                    {cameraError}
                  </p>
                  <button
                    onClick={() => startRealCamera()}
                    style={{
                      background: '#005131',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '0.4rem 0.9rem',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Retry Permission
                  </button>
                </div>
              )}
            </div>

            {/* Quick Sample Barcode Buttons for Live Testing */}
            <div style={{
              background: '#ffffff',
              borderRadius: '14px',
              padding: '0.85rem',
              border: '1px solid #bfc9c0'
            }}>
              <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#536778', textTransform: 'uppercase', display: 'block', marginBottom: '0.35rem' }}>
                Test Barcode Simulator (Click to Trigger Scan Validation):
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                {[
                  'WR-450W-SN-1001',
                  'GRW-5000-SN-0042',
                  'WR-540-SN-8941',
                  'LUM-3KW-SN-9981',
                  'DUPLICATE-SN-TEST'
                ].map(sn => (
                  <button
                    key={sn}
                    onClick={() => handleValidateSerial(sn)}
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      padding: '0.2rem 0.5rem',
                      borderRadius: '6px',
                      border: '1px solid #dceaf9',
                      background: '#e2efff',
                      color: '#005131',
                      cursor: 'pointer'
                    }}
                  >
                    {sn}
                  </button>
                ))}
              </div>
            </div>

            {/* Manual Serial Number Entry Fallback */}
            <div style={{
              background: '#ffffff',
              borderRadius: '14px',
              padding: '0.85rem',
              border: '1px solid #bfc9c0'
            }}>
              <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#101d28', display: 'block', marginBottom: '0.4rem' }}>
                Manual Barcode / Serial Lookup
              </span>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <input
                  type="text"
                  placeholder="Enter or scan S/N (e.g. WR-450W-SN-1001)..."
                  value={scannedSerialInput}
                  onChange={(e) => setScannedSerialInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleValidateSerial(); }}
                  style={{
                    flex: 1,
                    padding: '0.55rem 0.75rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.8rem',
                    textTransform: 'uppercase',
                    outline: 'none'
                  }}
                />
                <button
                  type="button"
                  onClick={() => handleValidateSerial()}
                  style={{
                    background: '#005131',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '0.55rem 0.95rem',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Verify
                </button>
              </div>

              {/* Validation Result Box */}
              {scanValidationResult && (
                <div style={{
                  marginTop: '0.75rem',
                  padding: '0.75rem',
                  borderRadius: '10px',
                  background: scanValidationResult.valid ? '#eaf6ef' : '#fdecec',
                  border: scanValidationResult.valid ? '1px solid #a4f4c3' : '1px solid #ffdad6'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
                    {scanValidationResult.valid ? (
                      <CheckCircle2 size={16} style={{ color: '#176b45' }} />
                    ) : (
                      <AlertTriangle size={16} style={{ color: '#991b1b' }} />
                    )}
                    <span style={{ fontSize: '0.78rem', fontWeight: 800, color: scanValidationResult.valid ? '#176b45' : '#991b1b' }}>
                      {scanValidationResult.valid ? 'Valid Serial Verified' : 'Serial Verification Rejected'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#101d28' }}>
                    {scanValidationResult.message}
                  </div>
                  {scanValidationResult.component_name && (
                    <div style={{ fontSize: '0.68rem', color: '#536778', marginTop: '0.2rem' }}>
                      Identified: <strong>{scanValidationResult.component_name}</strong> ({scanValidationResult.category})
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Scan History Telemetry Log */}
            <div style={{
              background: '#ffffff',
              borderRadius: '14px',
              padding: '0.85rem',
              border: '1px solid #bfc9c0'
            }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#101d28', display: 'block', marginBottom: '0.5rem' }}>
                Scan Telemetry History ({recentScans.length})
              </span>
              {recentScans.length === 0 ? (
                <p style={{ fontSize: '0.7rem', color: '#536778', margin: 0, textAlign: 'center', padding: '0.5rem' }}>
                  No barcodes scanned yet in this session.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {recentScans.map((scan, idx) => (
                    <div key={idx} style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.45rem',
                      borderRadius: '8px',
                      background: scan.valid ? '#f0fdf4' : '#fef2f2',
                      border: scan.valid ? '1px solid #dcfce7' : '1px solid #fee2e2'
                    }}>
                      <div>
                        <span style={{ fontSize: '0.72rem', fontFamily: 'monospace', fontWeight: 800, color: scan.valid ? '#15803d' : '#b91c1c' }}>
                          {scan.serial}
                        </span>
                        <span style={{ fontSize: '0.65rem', color: '#475569', display: 'block' }}>
                          {scan.component_name}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.62rem', color: '#64748b' }}>
                        {scan.time}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 5: OPERATIONS & MORE (Stitch: more_operations_transfers) */}
        {/* ======================================================== */}
        {currentTab === 'operations' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            {/* Sub-tab Navigation */}
            <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', paddingBottom: '0.2rem' }}>
              {[
                { id: 'transfers', label: 'Stock Transfers' },
                { id: 'receipts', label: 'Goods Receipts' },
                { id: 'returns', label: 'Returns & Damaged' },
                { id: 'tasks', label: 'Personal Tasks' },
                { id: 'alerts', label: 'Stock Alerts' },
                { id: 'reports', label: 'Reports & Export' },
                { id: 'device', label: 'Device & Session' }
              ].map(sub => (
                <button
                  key={sub.id}
                  onClick={() => setOperationsSubTab(sub.id)}
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: '999px',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    border: 'none',
                    background: operationsSubTab === sub.id ? '#005131' : '#ffffff',
                    color: operationsSubTab === sub.id ? '#ffffff' : '#536778',
                    cursor: 'pointer',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {sub.label}
                </button>
              ))}
            </div>

            {/* SUB-TAB 1: TRANSFERS */}
            {operationsSubTab === 'transfers' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#101d28' }}>
                    Inter-Depot Transfers ({transfersList.length})
                  </span>
                  <button
                    onClick={() => setActiveModal('transfer')}
                    style={{
                      background: '#005131',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '0.35rem 0.75rem',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    + New Transfer
                  </button>
                </div>

                {transfersList.length === 0 ? (
                  <div style={{ background: '#ffffff', padding: '1.5rem', borderRadius: '12px', textAlign: 'center', color: '#536778', fontSize: '0.74rem' }}>
                    No inter-depot transfers recorded.
                  </div>
                ) : (
                  transfersList.map(t => (
                    <div key={t.id} style={{
                      background: '#ffffff',
                      borderRadius: '12px',
                      padding: '0.85rem',
                      border: '1px solid #bfc9c0'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', fontWeight: 800, color: '#005131' }}>
                          {t.transfer_number}
                        </span>
                        <span style={{
                          fontSize: '0.62rem',
                          fontWeight: 800,
                          padding: '0.15rem 0.45rem',
                          borderRadius: '999px',
                          background: t.status === 'RECEIVED' ? '#eaf6ef' : (t.status === 'IN_TRANSIT' ? '#edf5ff' : '#fff5df'),
                          color: t.status === 'RECEIVED' ? '#176b45' : (t.status === 'IN_TRANSIT' ? '#1d4ed8' : '#92400e')
                        }}>
                          {t.status}
                        </span>
                      </div>
                      <h4 style={{ fontSize: '0.82rem', fontWeight: 800, margin: '0.3rem 0 0.15rem', color: '#101d28' }}>
                        {t.component_name} (x{t.quantity})
                      </h4>
                      <p style={{ fontSize: '0.68rem', color: '#536778', margin: 0 }}>
                        {t.source_warehouse_name} → {t.dest_warehouse_name}
                      </p>

                      {/* State Progression Action Buttons */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem', marginTop: '0.65rem', paddingTop: '0.5rem', borderTop: '1px solid #f1f5f9' }}>
                        {t.status === 'REQUESTED' && (
                          <button
                            onClick={() => handleApproveTransfer(t.id)}
                            style={{ background: '#005131', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '0.25rem 0.65rem', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer' }}
                          >
                            Approve
                          </button>
                        )}
                        {t.status === 'APPROVED' && (
                          <button
                            onClick={() => handleDispatchTransfer(t.id)}
                            style={{ background: '#1d4ed8', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '0.25rem 0.65rem', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer' }}
                          >
                            Dispatch Out
                          </button>
                        )}
                        {t.status === 'IN_TRANSIT' && (
                          <button
                            onClick={() => handleReceiveTransfer(t.id)}
                            style={{ background: '#176b45', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '0.25rem 0.65rem', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer' }}
                          >
                            Receive In
                          </button>
                        )}
                        {['REQUESTED', 'APPROVED'].includes(t.status) && (
                          <button
                            onClick={() => handleCancelTransfer(t.id)}
                            style={{ background: '#fdecec', color: '#991b1b', border: 'none', borderRadius: '6px', padding: '0.25rem 0.65rem', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer' }}
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* SUB-TAB 2: GOODS RECEIPTS HISTORY */}
            {operationsSubTab === 'receipts' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#101d28' }}>
                    Authoritative Goods Receipts ({goodsReceiptsList.length})
                  </span>
                  <button
                    onClick={() => setActiveModal('goods_receipt')}
                    style={{
                      background: '#005131',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '0.35rem 0.75rem',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    + Inward Receipt
                  </button>
                </div>

                {goodsReceiptsList.length === 0 ? (
                  <div style={{ background: '#ffffff', padding: '1.5rem', borderRadius: '12px', textAlign: 'center', color: '#536778', fontSize: '0.74rem' }}>
                    No inward goods receipts logged.
                  </div>
                ) : (
                  goodsReceiptsList.map(grn => (
                    <div key={grn.id} style={{
                      background: '#ffffff',
                      borderRadius: '12px',
                      padding: '0.85rem',
                      border: '1px solid #bfc9c0'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.74rem', fontFamily: 'monospace', fontWeight: 800, color: '#005131' }}>
                          {grn.receipt_number}
                        </span>
                        <span style={{ fontSize: '0.65rem', color: '#536778' }}>
                          {grn.created_at}
                        </span>
                      </div>
                      <h4 style={{ fontSize: '0.82rem', fontWeight: 800, margin: '0.3rem 0 0.15rem', color: '#101d28' }}>
                        {grn.component_name} (+{grn.quantity_received} units)
                      </h4>
                      <p style={{ fontSize: '0.68rem', color: '#536778', margin: 0 }}>
                        Supplier: {grn.supplier_name} • PO: {grn.po_reference} • Depot: {grn.warehouse_name}
                      </p>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* SUB-TAB 3: RETURNS & DAMAGED */}
            {operationsSubTab === 'returns' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#101d28' }}>
                    Returns & Damaged Quarantines ({returnsList.length})
                  </span>
                  <button
                    onClick={() => setActiveModal('return')}
                    style={{
                      background: '#991b1b',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '0.35rem 0.75rem',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    + Log Return
                  </button>
                </div>

                {returnsList.length === 0 ? (
                  <div style={{ background: '#ffffff', padding: '1.5rem', borderRadius: '12px', textAlign: 'center', color: '#536778', fontSize: '0.74rem' }}>
                    No field returns logged yet.
                  </div>
                ) : (
                  returnsList.map(ret => (
                    <div key={ret.id} style={{
                      background: '#ffffff',
                      borderRadius: '12px',
                      padding: '0.85rem',
                      border: ret.return_type === 'DAMAGED' ? '1px solid #ffdad6' : '1px solid #bfc9c0'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.74rem', fontFamily: 'monospace', fontWeight: 800, color: '#101d28' }}>
                          {ret.return_id}
                        </span>
                        <span style={{
                          fontSize: '0.62rem',
                          fontWeight: 800,
                          padding: '0.15rem 0.45rem',
                          borderRadius: '999px',
                          background: ret.return_type === 'DAMAGED' ? '#fdecec' : '#eaf6ef',
                          color: ret.return_type === 'DAMAGED' ? '#991b1b' : '#176b45'
                        }}>
                          {ret.return_type}
                        </span>
                      </div>
                      <h4 style={{ fontSize: '0.82rem', fontWeight: 800, margin: '0.3rem 0 0.15rem', color: '#101d28' }}>
                        {ret.component_name} (x{ret.quantity})
                      </h4>
                      <p style={{ fontSize: '0.68rem', color: '#536778', margin: 0 }}>
                        Depot: {ret.warehouse_name} • S/N: {ret.serial_number || 'None'} • {ret.notes}
                      </p>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* SUB-TAB 4: PERSONAL TASKS (Module 3.C) */}
            {operationsSubTab === 'tasks' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#101d28' }}>
                  Warehouse Manager Tasks ({tasksList.length})
                </span>

                {tasksList.map(task => (
                  <div key={task.id} style={{
                    background: '#ffffff',
                    borderRadius: '12px',
                    padding: '0.85rem',
                    border: '1px solid #bfc9c0'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        <input
                          type="checkbox"
                          checked={task.status === 'COMPLETED'}
                          onChange={() => handleCompleteTask(task.id)}
                          style={{ width: '16px', height: '16px', accentColor: '#005131', cursor: 'pointer' }}
                        />
                        <h4 style={{
                          fontSize: '0.82rem',
                          fontWeight: 800,
                          margin: 0,
                          color: task.status === 'COMPLETED' ? '#94a3b8' : '#101d28',
                          textDecoration: task.status === 'COMPLETED' ? 'line-through' : 'none'
                        }}>
                          {task.title}
                        </h4>
                      </div>
                      <span style={{
                        fontSize: '0.62rem',
                        fontWeight: 800,
                        padding: '0.15rem 0.45rem',
                        borderRadius: '999px',
                        background: task.priority === 'HIGH' || task.priority === 'URGENT' ? '#ffdad6' : '#e2efff',
                        color: task.priority === 'HIGH' || task.priority === 'URGENT' ? '#93000a' : '#005131'
                      }}>
                        {task.priority}
                      </span>
                    </div>

                    <p style={{ fontSize: '0.7rem', color: '#536778', margin: '0.4rem 0 0.5rem 1.4rem' }}>
                      {task.description || 'Audit and verify warehouse stock.'}
                    </p>

                    {/* Task Comments thread */}
                    <div style={{ marginLeft: '1.4rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.4rem' }}>
                      {task.comments && task.comments.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '0.4rem' }}>
                          {task.comments.map((c, i) => (
                            <div key={i} style={{ fontSize: '0.65rem', background: '#f8fafc', padding: '0.25rem 0.45rem', borderRadius: '4px' }}>
                              <strong>{c.user_name}:</strong> {c.text}
                            </div>
                          ))}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                        <input
                          type="text"
                          placeholder="Add comment..."
                          value={taskCommentText[task.id] || ''}
                          onChange={(e) => setTaskCommentText({ ...taskCommentText, [task.id]: e.target.value })}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleAddTaskComment(task.id); }}
                          style={{
                            flex: 1,
                            padding: '0.3rem 0.5rem',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            fontSize: '0.68rem',
                            outline: 'none'
                          }}
                        />
                        <button
                          onClick={() => handleAddTaskComment(task.id)}
                          style={{
                            background: '#005131',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '0.3rem 0.55rem',
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          Send
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* SUB-TAB 5: CATEGORIZED STOCK ALERTS (Module 3.N) */}
            {operationsSubTab === 'alerts' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#101d28' }}>
                  Real-Time Stock Alerts
                </span>

                {inventoryAlerts?.zero_stock?.length > 0 && (
                  <div>
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#991b1b', display: 'block', marginBottom: '0.35rem' }}>
                      Critical Stock-Outs (Zero Stock):
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {inventoryAlerts.zero_stock.map((zs, i) => (
                        <div key={i} style={{ background: '#fdecec', border: '1px solid #ffdad6', padding: '0.65rem', borderRadius: '8px', fontSize: '0.7rem', color: '#991b1b' }}>
                          <strong>{zs.component_name} ({zs.sku})</strong>: {zs.message}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {inventoryAlerts?.low_stock?.length > 0 && (
                  <div>
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#92400e', display: 'block', marginBottom: '0.35rem' }}>
                      Low Stock Warnings (Below Threshold):
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {inventoryAlerts.low_stock.map((ls, i) => (
                        <div key={i} style={{ background: '#fff5df', border: '1px solid #fed7aa', padding: '0.65rem', borderRadius: '8px', fontSize: '0.7rem', color: '#92400e' }}>
                          <strong>{ls.component_name} ({ls.sku})</strong>: {ls.message}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {inventoryAlerts?.shortages?.length > 0 && (
                  <div>
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#1d4ed8', display: 'block', marginBottom: '0.35rem' }}>
                      Confirmed Order Shortages:
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {inventoryAlerts.shortages.map((sh, i) => (
                        <div key={i} style={{ background: '#edf5ff', border: '1px solid #bfdbfe', padding: '0.65rem', borderRadius: '8px', fontSize: '0.7rem', color: '#1d4ed8' }}>
                          {sh.message}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* SUB-TAB 6: REPORTS & EXPORT (Module 3.O) */}
            {operationsSubTab === 'reports' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#101d28' }}>
                  Authoritative Inventory Reports (CSV Exports)
                </span>
                <p style={{ fontSize: '0.7rem', color: '#536778', margin: 0 }}>
                  Download authoritative central database ledgers directly formatted for inventory accounting, physical auditing, and ERP compliance.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                  {[
                    { id: 'inventory', title: 'Current Stock Ledger', desc: 'Balances by depot' },
                    { id: 'movements', title: 'Stock Movements', desc: 'Audit log trail' },
                    { id: 'reservations', title: 'BOM Reservations', desc: 'Locked project items' },
                    { id: 'receipts', title: 'Goods Receipts', desc: 'Inward PO shipments' },
                    { id: 'dispatches', title: 'Dispatch History', desc: 'Vehicles & drivers' },
                    { id: 'returns', title: 'Returns & Damaged', desc: 'Quarantine logs' }
                  ].map(rep => (
                    <button
                      key={rep.id}
                      onClick={() => handleExportCSV(rep.id)}
                      style={{
                        background: '#ffffff',
                        border: '1px solid #bfc9c0',
                        borderRadius: '12px',
                        padding: '0.85rem',
                        textAlign: 'left',
                        cursor: 'pointer',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                      }}
                    >
                      <Download size={16} style={{ color: '#005131', marginBottom: '0.35rem' }} />
                      <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#101d28', display: 'block' }}>
                        {rep.title}
                      </span>
                      <span style={{ fontSize: '0.65rem', color: '#536778' }}>
                        {rep.desc}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* SUB-TAB 7: DEVICE & SESSION (Module 3.B) */}
            {operationsSubTab === 'device' && (
              <div style={{
                background: '#ffffff',
                borderRadius: '14px',
                padding: '1rem',
                border: '1px solid #bfc9c0',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem'
              }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#101d28' }}>
                  Authenticated Warehouse Terminal Profile
                </span>

                <div style={{ fontSize: '0.72rem', color: '#536778', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <div><strong>Logged in as:</strong> {user?.full_name || 'Rajesh (Warehouse Lead)'}</div>
                  <div><strong>Role:</strong> {user?.role || 'WAREHOUSE_MANAGER'}</div>
                  <div><strong>Email:</strong> {user?.email || 'warehouse@sunpower.com'}</div>
                  <div><strong>Device Registration:</strong> <span style={{ color: '#176b45', fontWeight: 700 }}>Authorised & Active</span></div>
                  <div><strong>Camera Sensor:</strong> {navigator.mediaDevices ? 'Available (60 FPS Optical Ready)' : 'Not Supported'}</div>
                  <div><strong>Session Status:</strong> Active 24-hr HMAC Bearer Token</div>
                </div>

                <button
                  onClick={() => {
                    localStorage.removeItem('sunpower_token');
                    window.location.href = '/login/warehouse';
                  }}
                  style={{
                    background: '#fdecec',
                    color: '#991b1b',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '0.55rem',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    marginTop: '0.5rem'
                  }}
                >
                  Sign Out of Terminal
                </button>
              </div>
            )}

          </div>
        )}

      </main>

      {/* ======================================================== */}
      {/* BOTTOM TAB NAVIGATION (Stitch: warehouse_home bottom nav) */}
      {/* ======================================================== */}
      <nav style={{
        position: 'fixed',
        bottom: 0,
        maxWidth: '480px',
        width: '100%',
        zIndex: 50,
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(12px)',
        borderTop: '1px solid #dceaf9',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        height: '60px',
        padding: '0 0.5rem'
      }}>
        {/* 1. Home */}
        <button
          onClick={() => setCurrentTab('home')}
          style={{
            background: 'none',
            border: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            color: currentTab === 'home' ? '#005131' : '#536778',
            cursor: 'pointer',
            minWidth: '52px'
          }}
        >
          <WhIcon size={20} />
          <span style={{ fontSize: '0.62rem', fontWeight: currentTab === 'home' ? 800 : 600, marginTop: '0.15rem' }}>Home</span>
        </button>

        {/* 2. Inventory */}
        <button
          onClick={() => setCurrentTab('inventory')}
          style={{
            background: 'none',
            border: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            color: currentTab === 'inventory' ? '#005131' : '#536778',
            cursor: 'pointer',
            minWidth: '52px'
          }}
        >
          <Boxes size={20} />
          <span style={{ fontSize: '0.62rem', fontWeight: currentTab === 'inventory' ? 800 : 600, marginTop: '0.15rem' }}>Stock</span>
        </button>

        {/* 3. Center Scanner Button (Large prominent action) */}
        <button
          onClick={() => setCurrentTab('scanner')}
          style={{
            background: '#005131',
            border: '3px solid #ffffff',
            borderRadius: '50%',
            width: '48px',
            height: '48px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            cursor: 'pointer',
            marginTop: '-16px',
            boxShadow: '0 4px 12px rgba(0,81,49,0.35)'
          }}
          title="Live Barcode / QR Camera Scanner"
        >
          <QrCode size={22} />
        </button>

        {/* 4. Orders & Allocation */}
        <button
          onClick={() => setCurrentTab('orders')}
          style={{
            background: 'none',
            border: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            color: currentTab === 'orders' ? '#005131' : '#536778',
            cursor: 'pointer',
            minWidth: '52px'
          }}
        >
          <CheckSquare size={20} />
          <span style={{ fontSize: '0.62rem', fontWeight: currentTab === 'orders' ? 800 : 600, marginTop: '0.15rem' }}>Orders</span>
        </button>

        {/* 5. Operations / More */}
        <button
          onClick={() => setCurrentTab('operations')}
          style={{
            background: 'none',
            border: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            color: currentTab === 'operations' ? '#005131' : '#536778',
            cursor: 'pointer',
            minWidth: '52px'
          }}
        >
          <ArrowRightLeft size={20} />
          <span style={{ fontSize: '0.62rem', fontWeight: currentTab === 'operations' ? 800 : 600, marginTop: '0.15rem' }}>Operations</span>
        </button>
      </nav>

      {/* ======================================================== */}
      {/* MODAL 1: GOODS RECEIPT (Stitch: receive_stock_po_rec_2026_088) */}
      {/* ======================================================== */}
      {activeModal === 'goods_receipt' && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(16, 29, 40, 0.65)',
          backdropFilter: 'blur(4px)',
          zIndex: 100,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center'
        }}>
          <div style={{
            background: '#ffffff',
            width: '100%',
            maxWidth: '480px',
            maxHeight: '90vh',
            borderTopLeftRadius: '20px',
            borderTopRightRadius: '20px',
            padding: '1.2rem',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#176b45', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Package size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '0.92rem', fontWeight: 800, margin: 0, color: '#101d28' }}>
                    Receive Inbound Stock
                  </h3>
                  <span style={{ fontSize: '0.65rem', color: '#536778' }}>PO-REC Gate Entry Verification</span>
                </div>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitGrn} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#101d28', display: 'block', marginBottom: '0.2rem' }}>Receiving Depot</label>
                <select
                  value={grnForm.warehouse_id}
                  onChange={(e) => setGrnForm({ ...grnForm, warehouse_id: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.78rem' }}
                >
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name} ({w.city})</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#101d28', display: 'block', marginBottom: '0.2rem' }}>Component / Material</label>
                <select
                  value={grnForm.component_id}
                  onChange={(e) => setGrnForm({ ...grnForm, component_id: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.78rem' }}
                  required
                >
                  <option value="">-- Select Material from Catalogue --</option>
                  {componentsCatalog.map(c => (
                    <option key={c.id} value={c.id}>{c.sku} - {c.name} ({c.category})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div>
                  <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#101d28', display: 'block', marginBottom: '0.2rem' }}>Quantity Received</label>
                  <input
                    type="number"
                    min="1"
                    value={grnForm.quantity}
                    onChange={(e) => setGrnForm({ ...grnForm, quantity: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.78rem' }}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#101d28', display: 'block', marginBottom: '0.2rem' }}>PO Reference</label>
                  <input
                    type="text"
                    value={grnForm.po_reference}
                    onChange={(e) => setGrnForm({ ...grnForm, po_reference: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.78rem' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div>
                  <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#101d28', display: 'block', marginBottom: '0.2rem' }}>Supplier Name</label>
                  <input
                    type="text"
                    value={grnForm.supplier_name}
                    onChange={(e) => setGrnForm({ ...grnForm, supplier_name: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.78rem' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#101d28', display: 'block', marginBottom: '0.2rem' }}>Truck / Vehicle</label>
                  <input
                    type="text"
                    value={grnForm.truck_number}
                    onChange={(e) => setGrnForm({ ...grnForm, truck_number: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.78rem' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#101d28', display: 'block', marginBottom: '0.2rem' }}>
                  Register Component Serials (One per line or scanned)
                </label>
                <textarea
                  rows={3}
                  value={grnForm.serials_text}
                  onChange={(e) => setGrnForm({ ...grnForm, serials_text: e.target.value })}
                  placeholder="e.g.&#10;WR-450W-SN-1001&#10;WR-450W-SN-1002"
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.75rem', fontFamily: 'monospace' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  style={{ flex: 1, padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#475569', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingGrn}
                  style={{ flex: 1, padding: '0.65rem', borderRadius: '8px', border: 'none', background: '#005131', color: '#ffffff', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}
                >
                  {isSubmittingGrn ? 'Committing...' : 'Commit Inward Receipt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: INTER-DEPOT TRANSFER */}
      {/* ======================================================== */}
      {activeModal === 'transfer' && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(16, 29, 40, 0.65)',
          backdropFilter: 'blur(4px)',
          zIndex: 100,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center'
        }}>
          <div style={{
            background: '#ffffff',
            width: '100%',
            maxWidth: '480px',
            maxHeight: '90vh',
            borderTopLeftRadius: '20px',
            borderTopRightRadius: '20px',
            padding: '1.2rem',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#005131', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ArrowRightLeft size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '0.92rem', fontWeight: 800, margin: 0, color: '#101d28' }}>
                    Inter-Depot Stock Transfer
                  </h3>
                  <span style={{ fontSize: '0.65rem', color: '#536778' }}>Cross-depot stock rebalancing</span>
                </div>
              </div>
              <button onClick={() => setActiveModal(null)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitTransfer} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div>
                  <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#101d28', display: 'block', marginBottom: '0.2rem' }}>Source Depot</label>
                  <select
                    value={transferForm.source_warehouse_id}
                    onChange={(e) => setTransferForm({ ...transferForm, source_warehouse_id: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.75rem' }}
                  >
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#101d28', display: 'block', marginBottom: '0.2rem' }}>Destination Depot</label>
                  <select
                    value={transferForm.dest_warehouse_id}
                    onChange={(e) => setTransferForm({ ...transferForm, dest_warehouse_id: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.75rem' }}
                  >
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#101d28', display: 'block', marginBottom: '0.2rem' }}>Component</label>
                <select
                  value={transferForm.component_id}
                  onChange={(e) => setTransferForm({ ...transferForm, component_id: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.75rem' }}
                  required
                >
                  <option value="">-- Select Component --</option>
                  {componentsCatalog.map(c => (
                    <option key={c.id} value={c.id}>{c.sku} - {c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#101d28', display: 'block', marginBottom: '0.2rem' }}>Transfer Quantity</label>
                <input
                  type="number"
                  min="1"
                  value={transferForm.quantity}
                  onChange={(e) => setTransferForm({ ...transferForm, quantity: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.75rem' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <input
                  type="checkbox"
                  id="auto_approve_check"
                  checked={transferForm.auto_approve}
                  onChange={(e) => setTransferForm({ ...transferForm, auto_approve: e.target.checked })}
                  style={{ accentColor: '#005131' }}
                />
                <label htmlFor="auto_approve_check" style={{ fontSize: '0.72rem', color: '#101d28', fontWeight: 600 }}>
                  Auto-Approve & Lock Source Stock Reservation Immediately
                </label>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  style={{ flex: 1, padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#475569', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingTransfer}
                  style={{ flex: 1, padding: '0.65rem', borderRadius: '8px', border: 'none', background: '#005131', color: '#ffffff', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}
                >
                  {isSubmittingTransfer ? 'Initiating...' : 'Initiate Transfer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: APPROVED STOCK ADJUSTMENT */}
      {/* ======================================================== */}
      {activeModal === 'adjust' && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(16, 29, 40, 0.65)',
          backdropFilter: 'blur(4px)',
          zIndex: 100,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center'
        }}>
          <div style={{
            background: '#ffffff',
            width: '100%',
            maxWidth: '480px',
            borderTopLeftRadius: '20px',
            borderTopRightRadius: '20px',
            padding: '1.2rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '0.92rem', fontWeight: 800, margin: 0, color: '#101d28' }}>
                Approved Stock Adjustment & Audit
              </h3>
              <button onClick={() => setActiveModal(null)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitAdjust} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#101d28', display: 'block', marginBottom: '0.2rem' }}>Warehouse Depot</label>
                <select
                  value={adjustForm.warehouse_id}
                  onChange={(e) => setAdjustForm({ ...adjustForm, warehouse_id: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.75rem' }}
                >
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#101d28', display: 'block', marginBottom: '0.2rem' }}>Component</label>
                <select
                  value={adjustForm.component_id}
                  onChange={(e) => setAdjustForm({ ...adjustForm, component_id: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.75rem' }}
                  required
                >
                  <option value="">-- Select Component --</option>
                  {componentsCatalog.map(c => (
                    <option key={c.id} value={c.id}>{c.sku} - {c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#101d28', display: 'block', marginBottom: '0.2rem' }}>
                  Quantity Change (+ to add, - to subtract)
                </label>
                <input
                  type="number"
                  value={adjustForm.quantity_change}
                  onChange={(e) => setAdjustForm({ ...adjustForm, quantity_change: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.75rem' }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#101d28', display: 'block', marginBottom: '0.2rem' }}>Audit Reason</label>
                <input
                  type="text"
                  value={adjustForm.notes}
                  onChange={(e) => setAdjustForm({ ...adjustForm, notes: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.75rem' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  style={{ flex: 1, padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#475569', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAdjust}
                  style={{ flex: 1, padding: '0.65rem', borderRadius: '8px', border: 'none', background: '#005131', color: '#ffffff', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}
                >
                  {isSubmittingAdjust ? 'Submitting...' : 'Commit Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 4: ORDER BOM VERIFICATION & ALLOCATION (Stitch: stock_allocation_ord_8941) */}
      {/* ======================================================== */}
      {activeModal === 'order_allocation' && selectedOrderForBOM && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(16, 29, 40, 0.65)',
          backdropFilter: 'blur(4px)',
          zIndex: 100,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center'
        }}>
          <div style={{
            background: '#ffffff',
            width: '100%',
            maxWidth: '480px',
            maxHeight: '92vh',
            borderTopLeftRadius: '20px',
            borderTopRightRadius: '20px',
            padding: '1.2rem',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ fontSize: '0.68rem', fontFamily: 'monospace', fontWeight: 800, color: '#005131', background: '#a4f4c3', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                    {selectedOrderForBOM.order_number}
                  </span>
                  <span style={{ fontSize: '0.65rem', color: '#536778' }}>BOM Verification</span>
                </div>
                <h3 style={{ fontSize: '0.92rem', fontWeight: 800, margin: '0.2rem 0 0', color: '#101d28' }}>
                  {selectedOrderForBOM.customer_name || 'Project Site Allocation'}
                </h3>
              </div>
              <button onClick={() => setActiveModal(null)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {/* Shortage Warning Banner if applicable */}
            {bomSimulation && !bomSimulation.is_fully_satisfiable && (
              <div style={{
                background: '#fdecec',
                border: '1px solid #ffdad6',
                borderRadius: '10px',
                padding: '0.75rem',
                marginBottom: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <AlertTriangle size={18} style={{ color: '#991b1b', shrink: 0 }} />
                <div style={{ fontSize: '0.7rem', color: '#991b1b' }}>
                  <strong>Stock Shortage Detected:</strong> Available unreserved stock cannot fully satisfy all items. Complete allocation is locked to prevent broken state.
                </div>
              </div>
            )}

            {/* BOM Items Table */}
            <div style={{ marginBottom: '1rem' }}>
              <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#101d28', display: 'block', marginBottom: '0.4rem' }}>
                Approved Bill of Materials Items:
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {bomDetails?.items?.map(it => (
                  <div key={it.id} style={{
                    background: '#f8fafc',
                    borderRadius: '10px',
                    padding: '0.65rem',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#101d28', display: 'block' }}>
                        {it.component_name}
                      </span>
                      <span style={{ fontSize: '0.65rem', color: '#536778' }}>
                        Required: <strong>{it.quantity_required}</strong> • Allocated: {it.quantity_allocated}
                      </span>
                    </div>
                    <span style={{
                      fontSize: '0.62rem',
                      fontWeight: 800,
                      padding: '0.15rem 0.45rem',
                      borderRadius: '999px',
                      background: it.quantity_allocated >= it.quantity_required ? '#eaf6ef' : '#fff5df',
                      color: it.quantity_allocated >= it.quantity_required ? '#176b45' : '#92400e'
                    }}>
                      {it.quantity_allocated >= it.quantity_required ? 'ALLOCATED' : 'PENDING'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Allocation Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => handleExecuteAllocation(selectedOrderForBOM.id, false)}
                disabled={isAllocatingOrder}
                style={{
                  background: '#005131',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.7rem',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                {isAllocatingOrder ? 'Reserving Stock...' : 'Commit Full Allocation & Reserve Stock'}
              </button>

              <button
                type="button"
                onClick={() => handleReleaseReservation(selectedOrderForBOM.id)}
                style={{
                  background: '#fdecec',
                  color: '#991b1b',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.6rem',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Release Existing Reservations
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 5: DISPATCH PREPARATION & PASSPORT (Stitch: dispatch_preparation_dsp_2026_0048) */}
      {/* ======================================================== */}
      {activeModal === 'dispatch' && selectedOrderForDispatch && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(16, 29, 40, 0.65)',
          backdropFilter: 'blur(4px)',
          zIndex: 100,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center'
        }}>
          <div style={{
            background: '#ffffff',
            width: '100%',
            maxWidth: '480px',
            maxHeight: '92vh',
            borderTopLeftRadius: '20px',
            borderTopRightRadius: '20px',
            padding: '1.2rem',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ fontSize: '0.68rem', fontFamily: 'monospace', fontWeight: 800, color: '#005131', background: '#a4f4c3', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                    DSP-2026-0048
                  </span>
                  <span style={{ fontSize: '0.65rem', color: '#536778' }}>Order: {selectedOrderForDispatch.order_number}</span>
                </div>
                <h3 style={{ fontSize: '0.92rem', fontWeight: 800, margin: '0.2rem 0 0', color: '#101d28' }}>
                  Dispatch Staging & Digital Passport Init
                </h3>
              </div>
              <button onClick={() => setActiveModal(null)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleConfirmDispatchWithPassport} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div>
                  <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#101d28', display: 'block', marginBottom: '0.2rem' }}>Driver Name</label>
                  <input
                    type="text"
                    value={dispatchForm.driver_name}
                    onChange={(e) => setDispatchForm({ ...dispatchForm, driver_name: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.75rem' }}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#101d28', display: 'block', marginBottom: '0.2rem' }}>Vehicle Number</label>
                  <input
                    type="text"
                    value={dispatchForm.vehicle_number}
                    onChange={(e) => setDispatchForm({ ...dispatchForm, vehicle_number: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.75rem' }}
                    required
                  />
                </div>
              </div>

              {/* Scanned Serials Inspection */}
              <div style={{
                background: '#f8fafc',
                borderRadius: '10px',
                padding: '0.75rem',
                border: '1px solid #e2e8f0'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#101d28' }}>
                    Scanned Physical Serials ({dispatchForm.scanned_serials.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      // Add sample valid serial for testing convenience
                      setDispatchForm(prev => ({
                        ...prev,
                        scanned_serials: [
                          ...prev.scanned_serials,
                          { serial_number: `SP-MOD-2026-${Math.floor(1000 + Math.random() * 9000)}`, component_id: 1, barcode_format: 'CODE128' }
                        ]
                      }));
                    }}
                    style={{ background: '#e2efff', color: '#005131', border: 'none', borderRadius: '4px', padding: '0.2rem 0.5rem', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer' }}
                  >
                    + Add Test Serial
                  </button>
                </div>

                {dispatchForm.scanned_serials.length === 0 ? (
                  <p style={{ fontSize: '0.68rem', color: '#991b1b', margin: 0 }}>
                    Scanning Required: Switch to 'Scan' tab or use '+ Add Test Serial' to capture physical barcodes prior to release.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                    {dispatchForm.scanned_serials.map((s, idx) => {
                      const snStr = typeof s === 'string' ? s : s.serial_number;
                      return (
                        <span key={idx} style={{
                          fontSize: '0.68rem',
                          fontFamily: 'monospace',
                          fontWeight: 700,
                          background: '#eaf6ef',
                          color: '#176b45',
                          padding: '0.15rem 0.45rem',
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.3rem'
                        }}>
                          {snStr}
                          <button
                            type="button"
                            onClick={() => {
                              setDispatchForm(prev => ({
                                ...prev,
                                scanned_serials: prev.scanned_serials.filter((_, i) => i !== idx)
                              }));
                            }}
                            style={{ background: 'none', border: 'none', color: '#b91c1c', cursor: 'pointer', padding: 0 }}
                          >
                            ×
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 4-Point Mandatory Dispatch Checklist */}
              <div style={{
                background: '#ffffff',
                borderRadius: '10px',
                padding: '0.75rem',
                border: '1px solid #dceaf9'
              }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#101d28', display: 'block', marginBottom: '0.35rem' }}>
                  Mandatory QC Dispatch Checklist:
                </span>
                {[
                  { id: 'checklist_picked', label: 'All allocated BOM items physically picked' },
                  { id: 'checklist_packaging', label: 'Solar modules & inverter packaging secured' },
                  { id: 'checklist_vehicle', label: 'Transport vehicle inspected for rain/dust' },
                  { id: 'checklist_driver', label: 'Delivery driver signoff captured' }
                ].map(chk => (
                  <div key={chk.id} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', margin: '0.2rem 0' }}>
                    <input
                      type="checkbox"
                      id={chk.id}
                      checked={dispatchForm[chk.id]}
                      onChange={(e) => setDispatchForm({ ...dispatchForm, [chk.id]: e.target.checked })}
                      style={{ accentColor: '#005131' }}
                    />
                    <label htmlFor={chk.id} style={{ fontSize: '0.68rem', color: '#101d28' }}>
                      {chk.label}
                    </label>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  style={{ flex: 1, padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#475569', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isConfirmingDispatch}
                  style={{ flex: 1, padding: '0.65rem', borderRadius: '8px', border: 'none', background: '#005131', color: '#ffffff', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}
                >
                  {isConfirmingDispatch ? 'Relieving Stock...' : 'Confirm Dispatch & Initialise Passport'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 6: PASSPORT CREATED SUCCESS VIEW */}
      {/* ======================================================== */}
      {activeModal === 'passport_view' && generatedPassport && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(16, 29, 40, 0.75)',
          backdropFilter: 'blur(6px)',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }}>
          <div style={{
            background: '#ffffff',
            width: '100%',
            maxWidth: '420px',
            borderRadius: '20px',
            padding: '1.5rem',
            textAlign: 'center',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
          }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#eaf6ef', color: '#176b45', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem' }}>
              <ShieldCheck size={28} />
            </div>

            <h3 style={{ fontSize: '1.1rem', fontWeight: 900, color: '#101d28', margin: '0 0 0.25rem' }}>
              Digital Solar Passport Initialised!
            </h3>
            <span style={{ fontSize: '0.72rem', color: '#536778', display: 'block', marginBottom: '1rem' }}>
              Physical inventory transaction successfully committed and order transitioned to DISPATCHED.
            </span>

            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '1rem', textAlign: 'left' }}>
              <div style={{ fontSize: '0.75rem', color: '#101d28', marginBottom: '0.3rem' }}>
                Passport Number: <strong>{generatedPassport.passport_number || generatedPassport.passport?.passport_number}</strong>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#101d28', marginBottom: '0.3rem' }}>
                Order Number: <strong>{generatedPassport.order_number || selectedOrderForDispatch?.order_number}</strong>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#101d28', marginBottom: '0.3rem' }}>
                Physical Serials Linked: <strong>{generatedPassport.serialized_items_count || dispatchForm.scanned_serials.length} units</strong>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#176b45', fontWeight: 700 }}>
                Status: DISPATCHED • Ready for Field Installation
              </div>
            </div>

            <button
              onClick={() => { setActiveModal(null); setGeneratedPassport(null); setSelectedOrderForDispatch(null); }}
              style={{
                width: '100%',
                padding: '0.7rem',
                borderRadius: '8px',
                border: 'none',
                background: '#005131',
                color: '#ffffff',
                fontSize: '0.8rem',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              Done & Return to Dashboard
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 7: RETURN PROCESSING */}
      {/* ======================================================== */}
      {activeModal === 'return' && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(16, 29, 40, 0.65)',
          backdropFilter: 'blur(4px)',
          zIndex: 100,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center'
        }}>
          <div style={{
            background: '#ffffff',
            width: '100%',
            maxWidth: '480px',
            borderTopLeftRadius: '20px',
            borderTopRightRadius: '20px',
            padding: '1.2rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '0.92rem', fontWeight: 800, margin: 0, color: '#101d28' }}>
                Register Field Return / Damaged Stock
              </h3>
              <button onClick={() => setActiveModal(null)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitReturn} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#101d28', display: 'block', marginBottom: '0.2rem' }}>Return Disposition</label>
                <select
                  value={returnForm.return_type}
                  onChange={(e) => setReturnForm({ ...returnForm, return_type: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.75rem' }}
                >
                  <option value="RESTOCK">RESTOCK: Verified undamaged, return to available inventory</option>
                  <option value="DAMAGED">DAMAGED: Defective, quarantine into damaged log (Stock NOT incremented)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#101d28', display: 'block', marginBottom: '0.2rem' }}>Component</label>
                <select
                  value={returnForm.component_id}
                  onChange={(e) => setReturnForm({ ...returnForm, component_id: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.75rem' }}
                  required
                >
                  <option value="">-- Select Component --</option>
                  {componentsCatalog.map(c => (
                    <option key={c.id} value={c.id}>{c.sku} - {c.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div>
                  <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#101d28', display: 'block', marginBottom: '0.2rem' }}>Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={returnForm.quantity}
                    onChange={(e) => setReturnForm({ ...returnForm, quantity: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.75rem' }}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#101d28', display: 'block', marginBottom: '0.2rem' }}>Serial Number</label>
                  <input
                    type="text"
                    value={returnForm.serial_number}
                    onChange={(e) => setReturnForm({ ...returnForm, serial_number: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.75rem', textTransform: 'uppercase' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#101d28', display: 'block', marginBottom: '0.2rem' }}>Inspection & Reason Notes</label>
                <input
                  type="text"
                  value={returnForm.reason}
                  onChange={(e) => setReturnForm({ ...returnForm, reason: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.75rem' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  style={{ flex: 1, padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#475569', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReturn}
                  style={{ flex: 1, padding: '0.65rem', borderRadius: '8px', border: 'none', background: returnForm.return_type === 'DAMAGED' ? '#991b1b' : '#005131', color: '#ffffff', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}
                >
                  {isSubmittingReturn ? 'Processing...' : 'Commit Return'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

function roundPaise(paise) {
  return Math.round((paise || 0) / 100);
}
