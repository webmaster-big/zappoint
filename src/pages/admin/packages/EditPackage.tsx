import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import Toast from "../../../components/ui/Toast";
import StandardButton from "../../../components/ui/StandardButton";
import { Info, Plus, Calendar, Clock, Gift, Tag, Home, ArrowLeft, Save, Trash2, X, GripVertical } from "lucide-react";
import { useThemeColor } from '../../../hooks/useThemeColor';
import { 
    attractionService, 
    addOnService, 
    roomService, 
    promoService, 
    giftCardService,
    packageService,
    categoryService
} from '../../../services';
import { roomCacheService } from '../../../services/RoomCacheService';
import { packageCacheService } from '../../../services/PackageCacheService';
import { addOnCacheService } from '../../../services/AddOnCacheService';
import { attractionCacheService } from '../../../services/AttractionCacheService';
import type { Category } from '../../../services/CategoryService';
import { formatTimeRange, formatDurationDisplay } from '../../../utils/timeFormat';
import type { 
    CreatePackageAttraction, 
    CreatePackageAddOn, 
    CreatePackageRoom,
    CreatePackagePromo,
    CreatePackageGiftCard
} from '../../../types/createPackage.types';
import type { AvailabilitySchedule } from '../../../services/PackageService';

// Helper function to get ordinal suffix (1st, 2nd, 3rd, etc.)
const getOrdinal = (n: number): string => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

// Helper function to sort rooms numerically (extracts numbers from room names)
const sortRoomsNumerically = (roomNames: string[]): string[] => {
    return [...roomNames].sort((a, b) => {
        // Extract numbers from room names (e.g., "Room 1" -> 1, "Space 10" -> 10)
        const numA = parseInt(a.replace(/\D/g, '')) || 0;
        const numB = parseInt(b.replace(/\D/g, '')) || 0;
        if (numA !== numB) return numA - numB;
        // If no numbers or same numbers, sort alphabetically
        return a.localeCompare(b);
    });
};

const EditPackage: React.FC = () => {
    const { themeColor, fullColor } = useThemeColor();
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [submitting, setSubmitting] = useState(false);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    
    // State for fetched data from backend
    const [attractions, setAttractions] = useState<CreatePackageAttraction[]>([]);
    const [addOns, setAddOns] = useState<CreatePackageAddOn[]>([]);
    const [categories, setCategories] = useState<Category[]>([]); // Fetch from API
    const [rooms, setRooms] = useState<CreatePackageRoom[]>([]);
    const [promos, setPromos] = useState<CreatePackagePromo[]>([]);
    const [giftCards, setGiftCards] = useState<CreatePackageGiftCard[]>([]);

    // Form state
    const [form, setForm] = useState({
        name: "",
        description: "",
        category: "",
        packageType: "regular" as string, // 'regular', 'holiday', 'special', 'seasonal'
        features: [""] as string[],
        attractions: [] as string[],
        rooms: [] as string[],
        price: "",
        minParticipants: "",
        maxParticipants: "",
        pricePerAdditional: "",
        duration: "",
        durationUnit: "hours" as "hours" | "minutes" | "hours and minutes",
        durationHours: "",
        durationMinutes: "",
        promos: [] as string[], // will store promo.code
        giftCards: [] as string[], // will store giftCard.code
        addOns: [] as string[],
        availabilityType: "daily" as "daily" | "weekly" | "monthly",
        availableDays: [] as string[],
        availableWeekDays: [] as string[],
        availableMonthDays: [] as string[],
        timeSlotStart: "09:00",
        timeSlotEnd: "17:00",
        timeSlotInterval: "30",
        availability_schedules: [] as AvailabilitySchedule[],
        image: "" as string, // base64 or data url
        partialPaymentPercentage: "0", // Percentage for partial payments
        partialPaymentFixed: "0", // Fixed amount for partial payments
        hasGuestOfHonor: false,
    });

    // Image preview state
    const [imagePreview, setImagePreview] = useState<string>("");

    // Fetch options data and then load package data
    useEffect(() => {
        const initializeData = async () => {
            if (!id) {
                setNotFound(true);
                setLoading(false);
                return;
            }

            try {
                // Check caches first before making API calls
                const cachedRooms = await roomCacheService.getCachedRooms();
                const cachedAddOns = await addOnCacheService.getCachedAddOns();
                const cachedAttractions = await attractionCacheService.getCachedAttractions();
                
                // Only fetch from API if cache is empty
                const roomsPromise = (cachedRooms && cachedRooms.length > 0) 
                    ? Promise.resolve({ data: { rooms: cachedRooms } })
                    : roomService.getRooms();
                    
                const addOnsPromise = (cachedAddOns && cachedAddOns.length > 0)
                    ? Promise.resolve({ data: { add_ons: cachedAddOns } })
                    : addOnService.getAddOns();

                const attractionsPromise = (cachedAttractions && cachedAttractions.length > 0)
                    ? Promise.resolve({ data: { attractions: cachedAttractions } })
                    : attractionService.getAttractions();
                
                // Step 1: Fetch all reference data first
                const [attractionsRes, addOnsRes, roomsRes, promosRes, giftCardsRes, categoriesRes] = await Promise.all([
                    attractionsPromise,
                    addOnsPromise,
                    roomsPromise,
                    promoService.getPromos(),
                    giftCardService.getGiftCards(),
                    categoryService.getCategories()
                ]);

                // Transform data to match component types (include id)
                const attractionsData = attractionsRes.data?.attractions?.map(attr => ({
                    id: attr.id,
                    name: attr.name,
                    price: attr.price || 0,
                    unit: attr.unit || ''
                })) || [];

                // Cache attractions if we fetched from API (not from cache)
                if (!cachedAttractions || cachedAttractions.length === 0) {
                    const attractionsList = attractionsRes.data?.attractions || [];
                    if (attractionsList.length > 0) {
                        await attractionCacheService.cacheAttractions(attractionsList);
                    }
                }

                const addOnsData = addOnsRes.data?.add_ons?.map(addon => ({
                    id: addon.id,
                    name: addon.name,
                    price: addon.price || 0
                })) || [];
                
                // Cache add-ons if we fetched from API (not from cache)
                if (!cachedAddOns || cachedAddOns.length === 0) {
                    const addOnsList = addOnsRes.data?.add_ons || [];
                    if (addOnsList.length > 0) {
                        await addOnCacheService.cacheAddOns(addOnsList);
                    }
                }

                // Rooms data - use the result from cache or API
                let roomsData: CreatePackageRoom[] = [];
                const roomsList = roomsRes.data?.rooms || [];
                roomsData = roomsList.map((room: any) => ({
                    id: room.id,
                    name: room.name,
                    area_group: room.area_group || undefined
                }));
                
                // Cache rooms if we fetched from API (not from cache)
                if (!cachedRooms || cachedRooms.length === 0) {
                    if (roomsList.length > 0) {
                        await roomCacheService.cacheRooms(roomsList);
                    }
                }

                const promosData = promosRes.data?.promos?.filter(promo => 
                    promo.status === "active" && !promo.deleted
                ).map(promo => ({
                    id: promo.id,
                    name: promo.name,
                    code: promo.code,
                    description: promo.description || ''
                })) || [];

                const giftCardsData = giftCardsRes.data?.gift_cards?.filter(gc => 
                    gc.status === "active" && !gc.deleted
                ).map(gc => ({
                    id: gc.id,
                    name: gc.code, // Use code as display name
                    code: gc.code,
                    description: gc.description || ''
                })) || [];

                const categoriesData = categoriesRes.data || [];

                // Set reference data state
                setAttractions(attractionsData);
                setAddOns(addOnsData);
                setRooms(roomsData);
                setPromos(promosData);
                setGiftCards(giftCardsData);
                setCategories(categoriesData);
                setCategories(categoriesData);

                // Step 2: Now fetch the package data
                console.log('Fetching package with ID:', id);
                const response = await packageService.getPackage(parseInt(id));
                console.log('Package API response:', response);
                
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const pkg = response.data as any; // Using 'any' to handle time slot fields that may not be in type yet
                
                console.log("Loaded package data:", pkg);
                
                // Check if response was successful but data is empty
                if (!pkg || !pkg.id) {
                    console.error('Package data is empty or missing ID');
                    setNotFound(true);
                    setLoading(false);
                    return;
                }

                // Extract names/codes from relationship objects (backend uses snake_case)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const attractionNames = pkg.attractions?.map((a: any) => typeof a === 'string' ? a : (a.name || '')) || [];
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const promoCodes = pkg.promos?.map((p: any) => typeof p === 'string' ? p : (p.code || '')) || [];
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const giftCardCodes = pkg.gift_cards?.map((g: any) => typeof g === 'string' ? g : (g.code || '')) || [];
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const addOnNames = pkg.add_ons?.map((a: any) => typeof a === 'string' ? a : (a.name || '')) || [];
                // Use add_ons_order if available for preserved drag-and-drop order, otherwise fall back to add_ons
                const orderedAddOnNames = (pkg.add_ons_order && pkg.add_ons_order.length > 0) 
                    ? pkg.add_ons_order.filter((name: string) => addOnNames.includes(name))
                    : addOnNames;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const roomNames = pkg.rooms?.map((r: any) => typeof r === 'string' ? r : (r.name || '')) || [];
                
                console.log("Extracted data:", {
                    attractionNames,
                    promoCodes,
                    giftCardCodes,
                    addOnNames,
                    orderedAddOnNames,
                    roomNames
                });

                // Convert arrays to strings if needed
                const availableDays = Array.isArray(pkg.available_days) 
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    ? pkg.available_days.map((d: any) => String(d)) 
                    : [];
                const availableWeekDays = Array.isArray(pkg.available_week_days) 
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    ? pkg.available_week_days.map((d: any) => String(d)) 
                    : [];
                const availableMonthDays = Array.isArray(pkg.available_month_days) 
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    ? pkg.available_month_days.map((d: any) => String(d)) 
                    : [];

                // Format time values from HH:MM:SS to HH:MM for HTML time input
                const formatTime = (time: string) => {
                    if (!time) return "09:00";
                    // If time is already in HH:MM format, return as is
                    if (time.length === 5) return time;
                    // If time is in HH:MM:SS format, extract HH:MM
                    return time.substring(0, 5);
                };

                // Parse duration for "hours and minutes" unit
                let durationHours = "";
                let durationMinutes = "";
                if (pkg.duration_unit === "hours and minutes" && pkg.duration) {
                    const decimalDuration = parseFloat(pkg.duration);
                    durationHours = String(Math.floor(decimalDuration));
                    durationMinutes = String(Math.round((decimalDuration % 1) * 60));
                }

                setForm({
                    name: pkg.name || "",
                    description: pkg.description || "",
                    category: pkg.category || "",
                    packageType: pkg.package_type || "regular",
                    features: Array.isArray(pkg.features) ? pkg.features : (pkg.features ? [pkg.features] : [""]),
                    attractions: attractionNames,
                    rooms: roomNames,
                    price: String(pkg.price || ""),
                    minParticipants: String(pkg.min_participants || ""),
                    maxParticipants: String(pkg.max_participants || ""),
                    pricePerAdditional: String(pkg.price_per_additional || ""),
                    duration: String(pkg.duration || ""),
                    durationUnit: pkg.duration_unit || "hours",
                    durationHours: durationHours,
                    durationMinutes: durationMinutes,
                    promos: promoCodes,
                    giftCards: giftCardCodes,
                    addOns: orderedAddOnNames,
                    availabilityType: pkg.availability_type || "daily",
                    availableDays: availableDays,
                    availableWeekDays: availableWeekDays,
                    availableMonthDays: availableMonthDays,
                    timeSlotStart: formatTime(pkg.time_slot_start || "09:00"),
                    timeSlotEnd: formatTime(pkg.time_slot_end || "17:00"),
                    timeSlotInterval: String(pkg.time_slot_interval || "30"),
                    // Format time fields in availability schedules to ensure HH:MM format
                    availability_schedules: (pkg.availability_schedules || []).map((schedule: AvailabilitySchedule) => ({
                        ...schedule,
                        time_slot_start: formatTime(schedule.time_slot_start || "09:00"),
                        time_slot_end: formatTime(schedule.time_slot_end || "17:00"),
                    })),
                    image: pkg.image || "",
                    partialPaymentPercentage: String(pkg.partial_payment_percentage || "0"),
                    partialPaymentFixed: String(pkg.partial_payment_fixed || "0"),
                    hasGuestOfHonor: pkg.has_guest_of_honor || false,
                });

                if (pkg.image) {
                    setImagePreview(pkg.image);
                }

                setLoading(false);
            } catch (error: unknown) {
                console.error("Error loading data:", error);
                
                // Type guard for axios errors
                const axiosError = error as { response?: { status?: number; data?: { message?: string } }; message?: string };
                
                // Check if it's a 404 (package not found) vs other errors
                if (axiosError.response?.status === 404) {
                    showToast("Package not found", "error");
                    setNotFound(true);
                } else {
                    // For other errors, show the error but don't mark as not found
                    const errorMsg = axiosError.response?.data?.message || axiosError.message || "Failed to load package data";
                    showToast(errorMsg, "error");
                    console.error("Error details:", {
                        status: axiosError.response?.status,
                        message: errorMsg,
                        error: error
                    });
                    // Don't set notFound for general errors - user might want to retry
                }
                setLoading(false);
            }
        };

        initializeData();
    }, [id]);

    // Handle image upload
    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setForm(prev => ({ ...prev, image: reader.result as string }));
                setImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    // Toast state
    const [toast, setToast] = useState<{ message: string; type?: "success" | "error" | "info" } | null>(null);
    const showToast = (message: string, type?: "success" | "error" | "info") => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 2200);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    // Handle feature input change
    const handleFeatureChange = (index: number, value: string) => {
        setForm((prev) => {
            const newFeatures = [...prev.features];
            newFeatures[index] = value;
            return { ...prev, features: newFeatures };
        });
    };

    // Add new feature input
    const handleAddFeature = () => {
        setForm((prev) => ({
            ...prev,
            features: [...prev.features, ""]
        }));
    };

    // Remove feature input
    const handleRemoveFeature = (index: number) => {
        setForm((prev) => ({
            ...prev,
            features: prev.features.filter((_, i) => i !== index)
        }));
    };

    // Drag and drop state for features
    const [draggedFeatureIndex, setDraggedFeatureIndex] = useState<number | null>(null);
    
    // Drag and drop handlers for features
    const handleFeatureDragStart = (index: number) => {
        setDraggedFeatureIndex(index);
    };
    
    const handleFeatureDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (draggedFeatureIndex === null || draggedFeatureIndex === index) return;
        
        setForm((prev) => {
            const newFeatures = [...prev.features];
            const draggedItem = newFeatures[draggedFeatureIndex];
            newFeatures.splice(draggedFeatureIndex, 1);
            newFeatures.splice(index, 0, draggedItem);
            setDraggedFeatureIndex(index);
            return { ...prev, features: newFeatures };
        });
    };
    
    const handleFeatureDragEnd = () => {
        setDraggedFeatureIndex(null);
    };

    // Drag and drop state for add-ons
    const [draggedAddOnIndex, setDraggedAddOnIndex] = useState<number | null>(null);
    
    // Drag and drop handlers for add-ons
    const handleAddOnDragStart = (index: number) => {
        setDraggedAddOnIndex(index);
    };
    
    const handleAddOnDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (draggedAddOnIndex === null || draggedAddOnIndex === index) return;
        
        setForm((prev) => {
            const newAddOns = [...prev.addOns];
            const draggedItem = newAddOns[draggedAddOnIndex];
            newAddOns.splice(draggedAddOnIndex, 1);
            newAddOns.splice(index, 0, draggedItem);
            setDraggedAddOnIndex(index);
            return { ...prev, addOns: newAddOns };
        });
    };
    
    const handleAddOnDragEnd = () => {
        setDraggedAddOnIndex(null);
    };

    // Multi-select for promos and gift cards
    const handleMultiSelectCheckbox = (name: 'promos' | 'giftCards', value: string) => {
        setForm((prev) => {
            const arr = prev[name] as string[];
            if (arr.includes(value)) {
                return { ...prev, [name]: arr.filter((v) => v !== value) };
            } else {
                return { ...prev, [name]: [...arr, value] };
            }
        });
    };

    const handleMultiSelect = (name: string, value: string) => {
        setForm((prev) => {
            const arr = prev[name as keyof typeof prev] as string[];
            if (arr.includes(value)) {
                return { ...prev, [name]: arr.filter((v) => v !== value) };
            } else {
                return { ...prev, [name]: [...arr, value] };
            }
        });
    };

    // Availability Schedule Management
    const addNewSchedule = () => {
        const newSchedule: AvailabilitySchedule = {
            availability_type: 'weekly',
            day_configuration: [],
            time_slot_start: '09:00',
            time_slot_end: '17:00',
            time_slot_interval: 30,
            priority: form.availability_schedules.length,
            is_active: true
        };
        setForm(prev => ({
            ...prev,
            availability_schedules: [...prev.availability_schedules, newSchedule]
        }));
    };

    const removeSchedule = (index: number) => {
        setForm(prev => ({
            ...prev,
            availability_schedules: prev.availability_schedules.filter((_, i) => i !== index)
        }));
    };

    // Update a specific schedule
    const updateSchedule = (index: number, updates: Partial<AvailabilitySchedule>) => {
        setForm(prev => ({
            ...prev,
            availability_schedules: prev.availability_schedules.map((schedule, i) =>
                i === index ? { ...schedule, ...updates } : schedule
            )
        }));
    };

    // Select all days for weekly schedule
    const selectAllWeekDays = (index: number) => {
        const allDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        const schedule = form.availability_schedules[index];
        const current = schedule.day_configuration || [];
        const allSelected = allDays.every(day => current.includes(day));
        updateSchedule(index, { day_configuration: allSelected ? [] : allDays });
    };

    // Add option with API calls instead of localStorage
    const handleAddOption = async (type: string, value: string, code?: string, extra?: string) => {
        if (!value.trim() || ((type === 'promo' || type === 'giftcard') && !code?.trim())) return;
        
        try {
            switch(type) {
                case 'addon':
                    if (!addOns.some(a => a.name === value)) {
                        const priceValue = parseFloat(extra || '0');
                        
                        if (isNaN(priceValue) || priceValue < 0) {
                            showToast("Please enter a valid price for the add-on", "error");
                            return;
                        }
                        
                        const price = Number(priceValue.toFixed(2)); // Ensure 2 decimal places
                        
                        await addOnService.createAddOn({
                            location_id: 1, // Default location
                            name: value,
                            price,
                            description: '',
                            is_active: true
                        });
                        const tempId = Date.now();
                        const updated = [...addOns, { id: tempId, name: value, price }];
                        setAddOns(updated);
                        showToast("Add-on added!", "success");
                    }
                    break;
                case 'category':
                    if (!categories.some(c => c.name === value)) {
                        const response = await categoryService.createCategory({ name: value });
                        if (response.success && response.data) {
                            setCategories(prev => [...prev, response.data]);
                            showToast("Category added successfully!", "success");
                        }
                    }
                    break;
                case 'room':
                    if (!rooms.some(r => r.name === value)) {
                        await roomService.createRoom({
                            location_id: 1, // Default location
                            name: value,
                            capacity: 20,
                            is_available: true
                        });
                        const tempId = Date.now();
                        const updated = [...rooms, { id: tempId, name: value }];
                        setRooms(updated);
                        showToast("Space added!", "success");
                    }
                    break;
                case 'promo':
                    if (!promos.some(p => p.name === value)) {
                        const description = extra || '';
                        await promoService.createPromo({
                            name: value,
                            code: code || '',
                            description,
                            type: 'fixed' as const,
                            value: 0,
                            start_date: new Date().toISOString().split('T')[0],
                            end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                            usage_limit_per_user: 1,
                            status: 'active' as const,
                            created_by: 1 // Default user ID
                        });
                        const tempId = Date.now();
                        const updated = [...promos, { id: tempId, name: value, code: code || '', description }];
                        setPromos(updated);
                        showToast("Promo added!", "success");
                    }
                    break;
                case 'giftcard':
                    if (!giftCards.some(g => g.code === code)) {
                        const description = extra || '';
                        const initialValue = 100;
                        await giftCardService.createGiftCard({
                            code: code || '',
                            type: 'fixed' as const,
                            initial_value: initialValue,
                            balance: initialValue,
                            max_usage: 1,
                            description,
                            status: 'active' as const,
                            created_by: 1 // Default user ID
                        });
                        const tempId = Date.now();
                        const updated = [...giftCards, { id: tempId, name: code || '', code: code || '', description }];
                        setGiftCards(updated);
                        showToast("Gift card added!", "success");
                    }
                    break;
            }
        } catch (error) {
            console.error(`Error adding ${type}:`, error);
            showToast(`Error adding ${type}`, "error");
        }
    };

    // On submit, update the package via API
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!id) {
            showToast("Package ID is missing!", "error");
            return;
        }

        // Validation
        if (!form.name.trim()) {
            showToast("Package name is required", "error");
            return;
        }

        if (!form.category) {
            showToast("Please select a category", "error");
            return;
        }

        const price = parseFloat(form.price);
        const minParticipants = form.minParticipants ? parseInt(form.minParticipants) : undefined;
        const pricePerAdditional = parseFloat(form.pricePerAdditional || '0');
        const maxParticipants = parseInt(form.maxParticipants || '0');

        // Calculate duration based on unit type
        let duration: number;
        if (form.durationUnit === 'hours and minutes') {
            const hours = parseInt(form.durationHours) || 0;
            const minutes = parseInt(form.durationMinutes) || 0;
            if (hours === 0 && minutes === 0) {
                showToast("Please enter a valid duration (hours and/or minutes)", "error");
                return;
            }
            // Convert to decimal hours: e.g., 1 hour 45 min = 1.75
            duration = hours + (minutes / 60);
        } else {
            duration = parseFloat(form.duration || '0');
        }

        if (isNaN(price) || price < 0) {
            showToast("Please enter a valid price", "error");
            return;
        }

        if (form.minParticipants && minParticipants && (isNaN(minParticipants) || minParticipants < 1)) {
            showToast("Please enter a valid min participants (minimum 1)", "error");
            return;
        }

        if (form.maxParticipants && (isNaN(maxParticipants) || maxParticipants < 1)) {
            showToast("Please enter a valid max participants (minimum 1)", "error");
            return;
        }

        if (form.pricePerAdditional && (isNaN(pricePerAdditional) || pricePerAdditional < 0)) {
            showToast("Please enter a valid price per additional participant", "error");
            return;
        }

        if (form.durationUnit !== 'hours and minutes' && form.duration && (isNaN(duration) || duration < 1)) {
            showToast("Please enter a valid duration", "error");
            return;
        }

        setSubmitting(true);
        try {
            // Get IDs for relationships from the options arrays (matching CreatePackage pattern)
            const attraction_ids = form.attractions
                .map(name => attractions.find(a => a.name === name)?.id)
                .filter(Boolean) as number[];

            const addon_ids = form.addOns
                .map(name => addOns.find(a => a.name === name)?.id)
                .filter(Boolean) as number[];

            const room_ids = form.rooms
                .map(name => rooms.find(r => r.name === name)?.id)
                .filter(Boolean) as number[];

            const promo_ids = form.promos
                .map(code => promos.find(p => p.code === code)?.id)
                .filter(Boolean) as number[];

            const gift_card_ids = form.giftCards
                .map(code => giftCards.find(g => g.code === code)?.id)
                .filter(Boolean) as number[];

            // Prepare data matching CreatePackage structure
            const updateData = {
                name: form.name,
                description: form.description,
                category: form.category,
                package_type: form.packageType,
                features: form.features.filter(f => f.trim()), // Filter out empty features
                price: Number(price.toFixed(2)),
                min_participants: minParticipants,
                max_participants: maxParticipants,
                price_per_additional: Number(pricePerAdditional.toFixed(2)),
                duration: duration,
                duration_unit: form.durationUnit,
                location_id: 1, // Default location ID
                partial_payment_percentage: form.partialPaymentPercentage ? parseInt(form.partialPaymentPercentage) : undefined,
                partial_payment_fixed: form.partialPaymentFixed ? parseInt(form.partialPaymentFixed) : undefined,
                has_guest_of_honor: form.hasGuestOfHonor,
                image: form.image || undefined,
                attraction_ids,
                addon_ids,
                room_ids,
                promo_ids,
                gift_card_ids,
                // Store add-ons order for display (uses add-on names)
                add_ons_order: form.addOns,
            };

            console.log("Updating package with data:", updateData);

            const response = await packageService.updatePackage(parseInt(id), updateData);
            console.log("Update response:", response);
            
            // Update availability schedules separately
            if (form.availability_schedules.length > 0) {
                try {
                    await packageService.updateAvailabilitySchedules(parseInt(id), {
                        schedules: form.availability_schedules
                    });
                } catch (scheduleError) {
                    console.error('Error updating availability schedules:', scheduleError);
                    showToast("Package updated but failed to update availability schedules", "error");
                    setSubmitting(false);
                    return;
                }
            }
            
            // Update in cache - wrap in try-catch to prevent white screen
            try {
                if (response?.success && response?.data) {
                    await packageCacheService.updatePackageInCache(response.data);
                }
            } catch (cacheError) {
                console.error('Error updating cache:', cacheError);
                // Don't fail the whole operation if cache update fails
            }
            
            showToast("Package updated successfully!", "success");
            setSubmitting(false);
            
            // Navigate back after a short delay
            navigate("/packages");
        } catch (error: unknown) {
            console.error("Error updating package:", error);
            
            // Better error messaging
            let errorMessage = "Error updating package. Please try again.";
            if (error && typeof error === 'object' && 'response' in error) {
                const axiosError = error as { response?: { data?: { message?: string } } };
                errorMessage = axiosError.response?.data?.message || errorMessage;
            }
            
            showToast(errorMessage, "error");
            setSubmitting(false);
        }
    };

    // Format availability for display
    const formatAvailability = () => {
        if (form.availability_schedules.length === 0) return "No schedules configured";
        return `${form.availability_schedules.length} schedule(s) configured`;
    };

    // Format duration for display
    const formatDuration = () => {
        if (form.durationUnit === 'hours and minutes') {
            const hours = parseInt(form.durationHours) || 0;
            const minutes = parseInt(form.durationMinutes) || 0;
            if (hours === 0 && minutes === 0) return "Not specified";
            if (hours > 0 && minutes > 0) return `${hours} hr ${minutes} min`;
            if (hours > 0) return `${hours} hr`;
            return `${minutes} min`;
        }
        if (!form.duration) return "Not specified";
        return formatDurationDisplay(parseFloat(form.duration), form.durationUnit);
    };

    // Loading state
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className={`animate-spin rounded-full h-12 w-12 border-b-2 border-${fullColor}`}></div>
            </div>
        );
    }

    // Not found state
    if (notFound) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center max-w-md mx-auto px-4">
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">Package Not Found</h2>
                    <p className="text-gray-600 mb-6">
                        The package with ID {id} doesn't exist or you don't have permission to access it.
                    </p>
                    <div className="flex gap-3 justify-center">
                        <Link
                            to="/packages"
                            className={`inline-flex items-center gap-2 bg-${themeColor}-700 hover:bg-${fullColor} text-white px-6 py-2 rounded-lg font-semibold`}
                        >
                            <ArrowLeft size={18} />
                            Back to Packages
                        </Link>
                        <StandardButton
                            onClick={() => window.location.reload()}
                            variant="secondary"
                            size="md"
                        >
                            Retry
                        </StandardButton>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full mx-auto sm:px-4 md:mt-8 pb-6 flex flex-col md:flex-row gap-8 md:gap-12">
            {/* Form Section */}
            <div className="flex-1 mx-auto">
                <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 md:p-8">
                    <div className="flex items-center gap-3 mb-6">
                        <Link
                            to="/packages"
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <ArrowLeft size={24} />
                        </Link>
                        <div>
                            <h2 className="text-2xl sm:text-3xl font-bold text-neutral-900 tracking-tight">Edit Package</h2>
                            <p className="text-sm text-gray-500 mt-1">Update the details of your package deal.</p>
                        </div>
                    </div>
                    
                    <form className="space-y-8" onSubmit={handleSubmit} autoComplete="off">
                        {/* Image Upload */}
                        <div>
                            <label className="block font-semibold mb-2 text-base text-neutral-800">Package Image</label>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleImageChange}
                                className={`block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-${themeColor}-50 file:text-${fullColor} hover:file:bg-${themeColor}-100`}
                            />
                            <p className="text-xs text-gray-500 mt-1">Accepts images below 20MB. We recommend using low file sizes with good quality to avoid loading issues.</p>
                            {imagePreview && (
                                <div className="mt-4">
                                    <img src={imagePreview} alt="Preview" className="w-full max-h-56 object-contain rounded-md border border-gray-200" />
                                </div>
                            )}
                        </div>

                        {/* Details Section */}
                        <div>
                            <h3 className={`text-xl font-bold mb-4 text-neutral-900 flex items-center gap-2`}>
                                <Info className={`w-5 h-5 text-${themeColor}-600`} /> Details
                            </h3>
                            <div className="space-y-5">
                                <div>
                                    <label className="block font-semibold mb-2 text-base text-neutral-800">Package Name</label>
                                    <input
                                        type="text"
                                        name="name"
                                        value={form.name}
                                        onChange={handleChange}
                                        className={`w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 bg-white text-neutral-900 text-base transition-all placeholder:text-gray-400`}
                                        placeholder="Enter package name"
                                        required
                                    />
                                </div>
                                
                                <div>
                                    <label className="block font-semibold mb-2 text-base text-neutral-800">Description</label>
                                    <textarea
                                        name="description"
                                        value={form.description}
                                        onChange={handleChange}
                                        rows={3}
                                        className={`w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 bg-white text-neutral-900 text-base transition-all placeholder:text-gray-400`}
                                        placeholder="Enter package description"
                                    />
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block font-semibold mb-2 text-base text-neutral-800">Category</label>
                                        <div className="flex gap-2">
                                            <div className="flex gap-1 items-center flex-1">
                                                <select
                                                    name="category"
                                                    value={form.category}
                                                    onChange={handleChange}
                                                    className={`w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 bg-white text-neutral-900 text-base transition-all`}
                                                >
                                                    <option value="">Select category</option>
                                                    {categories.map((cat) => (
                                                        <option key={cat.id} value={cat.name}>{cat.name}</option>
                                                    ))}
                                                </select>
                                                {form.category && (
                                                    <StandardButton
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={async () => {
                                                            const category = categories.find(c => c.name === form.category);
                                                            if (category && window.confirm(`Are you sure you want to delete the category "${category.name}"?`)) {
                                                                try {
                                                                    await categoryService.deleteCategory(category.id);
                                                                    setCategories(prev => prev.filter(c => c.id !== category.id));
                                                                    setForm(prev => ({ ...prev, category: '' }));
                                                                    showToast("Category deleted successfully!", "success");
                                                                } catch (error) {
                                                                    console.error('Error deleting category:', error);
                                                                    showToast("Error deleting category", "error");
                                                                }
                                                            }
                                                        }}
                                                        className="!p-2 text-red-600 hover:bg-red-50"
                                                        icon={Trash2}
                                                    >
                                                        {""}
                                                    </StandardButton>
                                                )}
                                            </div>
                                            <div className="flex gap-1 items-center">
                                                <input
                                                    type="text"
                                                    placeholder="New category"
                                                    className="rounded-md border border-gray-200 px-3 py-2 bg-white text-base min-w-0 w-32"
                                                    onKeyDown={async (e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            await handleAddOption('category', (e.target as HTMLInputElement).value);
                                                            (e.target as HTMLInputElement).value = '';
                                                        }
                                                    }}
                                                />
                                                <StandardButton
                                                    variant="ghost"
                                                    size="sm"
                                                    className="!p-2"
                                                    icon={Plus}
                                                    onClick={async () => {
                                                        const input = document.querySelector('input[placeholder="New category"]') as HTMLInputElement;
                                                        if (input?.value) {
                                                            await handleAddOption('category', input.value);
                                                            input.value = '';
                                                        }
                                                    }}
                                                >
                                                    {""}
                                                </StandardButton>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Package Type */}
                                <div>
                                    <label className="block font-semibold mb-2 text-base text-neutral-800">Package Type</label>
                                    <select
                                        name="packageType"
                                        value={form.packageType}
                                        onChange={handleChange}
                                        className={`w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 bg-white text-neutral-900 text-base transition-all`}
                                    >
                                        <option value="regular">Regular</option>
                                        <option value="custom">Custom</option>
                                        <option value="holiday">Holiday</option>
                                        <option value="special">Special</option>
                                        <option value="seasonal">Seasonal</option>
                                    </select>
                                    <p className="text-xs text-gray-500 mt-1">
                                        Use "Regular" for standard packages. Other types will appear in the Custom Packages section.
                                    </p>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block font-semibold mb-2 text-base text-neutral-800">Min Participants</label>
                                        <input
                                            type="number"
                                            name="minParticipants"
                                            value={form.minParticipants}
                                            onChange={handleChange}
                                            onWheel={(e) => (e.target as HTMLInputElement).blur()}
                                            className={`w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 bg-white text-neutral-900 text-base transition-all placeholder:text-gray-400`}
                                            min="1"
                                            placeholder="Enter min participants"
                                        />
                                    </div>
                                    
                                    <div>
                                        <label className="block font-semibold mb-2 text-base text-neutral-800">Max Participants</label>
                                        <input
                                            type="number"
                                            name="maxParticipants"
                                            value={form.maxParticipants}
                                            onChange={handleChange}
                                            onWheel={(e) => (e.target as HTMLInputElement).blur()}
                                            className={`w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 bg-white text-neutral-900 text-base transition-all placeholder:text-gray-400`}
                                            min="0"
                                            placeholder="Enter max participants"
                                        />
                                    </div>
                                </div>
                                
                                {/* Additional Pricing Section */}
                                {form.maxParticipants && (
                                    <div>
                                        <label className="block font-semibold mb-2 text-base text-neutral-800">Price per Additional Participant</label>
                                        <input
                                            type="number"
                                            name="pricePerAdditional"
                                            value={form.pricePerAdditional}
                                            onChange={handleChange}
                                            onWheel={(e) => (e.target as HTMLInputElement).blur()}
                                            className={`w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 bg-white text-neutral-900 text-base transition-all placeholder:text-gray-400`}
                                            min="0"
                                            step="0.01"
                                            placeholder="Enter price per additional"
                                        />
                                    </div>
                                )}
                                
                                <div>
                                    <label className="block font-semibold mb-2 text-base text-neutral-800">Duration</label>
                                    <div className="space-y-2">
                                        <select
                                            name="durationUnit"
                                            value={form.durationUnit}
                                            onChange={handleChange}
                                            className={`w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 bg-white text-neutral-900 text-base transition-all`}
                                        >
                                            <option value="hours">Hours</option>
                                            <option value="minutes">Minutes</option>
                                            <option value="hours and minutes">Hours & Minutes</option>
                                        </select>
                                        {form.durationUnit === 'hours and minutes' ? (
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-xs text-gray-600 mb-1">Hours</label>
                                                    <input
                                                        type="number"
                                                        name="durationHours"
                                                        value={form.durationHours}
                                                        onChange={handleChange}
                                                        onWheel={(e) => (e.target as HTMLInputElement).blur()}
                                                        className={`w-full rounded-md border border-gray-200 px-3 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 bg-white text-neutral-900 text-base transition-all placeholder:text-gray-400`}
                                                        min="0"
                                                        placeholder="0"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-gray-600 mb-1">Minutes</label>
                                                    <input
                                                        type="number"
                                                        name="durationMinutes"
                                                        value={form.durationMinutes}
                                                        onChange={handleChange}
                                                        onWheel={(e) => (e.target as HTMLInputElement).blur()}
                                                        className={`w-full rounded-md border border-gray-200 px-3 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 bg-white text-neutral-900 text-base transition-all placeholder:text-gray-400`}
                                                        min="0"
                                                        max="59"
                                                        placeholder="0"
                                                    />
                                                </div>
                                            </div>
                                        ) : (
                                            <input
                                                type="number"
                                                name="duration"
                                                value={form.duration}
                                                onChange={handleChange}
                                                onWheel={(e) => (e.target as HTMLInputElement).blur()}
                                                className={`w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 bg-white text-neutral-900 text-base transition-all placeholder:text-gray-400`}
                                                min="1"
                                                placeholder="Enter duration"
                                            />
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <label className="block font-semibold mb-2 text-base text-neutral-800">Features <span className="text-xs font-normal text-gray-500">(drag to reorder)</span></label>
                                    <div className="space-y-2">
                                        {form.features.map((feature, index) => (
                                            <div 
                                                key={index} 
                                                className={`flex gap-2 ${draggedFeatureIndex === index ? 'opacity-50' : ''}`}
                                                draggable
                                                onDragStart={() => handleFeatureDragStart(index)}
                                                onDragOver={(e) => handleFeatureDragOver(e, index)}
                                                onDragEnd={handleFeatureDragEnd}
                                            >
                                                <div className="flex items-center cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600">
                                                    <GripVertical className="w-5 h-5" />
                                                </div>
                                                <input
                                                    type="text"
                                                    value={feature}
                                                    onChange={(e) => handleFeatureChange(index, e.target.value)}
                                                    className={`flex-1 rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 bg-white text-neutral-900 text-base transition-all placeholder:text-gray-400`}
                                                    placeholder={`Feature ${index + 1}`}
                                                />
                                                {form.features.length > 1 && (
                                                    <StandardButton
                                                        variant="danger"
                                                        size="md"
                                                        onClick={() => handleRemoveFeature(index)}
                                                    >
                                                        ×
                                                    </StandardButton>
                                                )}
                                            </div>
                                        ))}
                                        <StandardButton
                                            variant="secondary"
                                            size="md"
                                            fullWidth
                                            onClick={handleAddFeature}
                                        >
                                            + Add Feature
                                        </StandardButton>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        {/* Availability Section */}
                        <div>
                            <h3 className={`text-xl font-bold mb-4 text-neutral-900 flex items-center gap-2`}>
                                <Calendar className={`w-5 h-5 text-${themeColor}-600`} /> Availability Schedules
                            </h3>
                            <div className="space-y-4">
                                <div className={`bg-${themeColor}-50 border border-${themeColor}-200 rounded-lg p-4`}>
                                    <p className={`text-sm text-${fullColor} mb-2`}>
                                        <strong>{form.availability_schedules.length}</strong> availability schedule(s) configured for this package.
                                    </p>
                                    <p className={`text-xs text-${fullColor}`}>
                                        Availability schedules are managed through the package creation system and define when this package can be booked with different time configurations.
                                    </p>
                                </div>
                                
                                {form.availability_schedules.length === 0 ? (
                                    <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                                        <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                                        <p className="text-gray-600 mb-4">No availability schedules configured</p>
                                        <StandardButton
                                            variant="primary"
                                            size="md"
                                            onClick={addNewSchedule}
                                            icon={Plus}
                                        >
                                            Add First Schedule
                                        </StandardButton>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {form.availability_schedules.map((schedule, index) => (
                                            <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50 relative">
                                                <StandardButton
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => removeSchedule(index)}
                                                    className="absolute top-3 right-3 !p-1 text-red-600 hover:bg-red-100"
                                                    icon={X}
                                                >
                                                    {""}
                                                </StandardButton>

                                                <div className="space-y-4">
                                                    {/* Schedule Type */}
                                                    <div>
                                                        <label className="block font-semibold mb-2 text-sm text-neutral-800">
                                                            Schedule Type
                                                        </label>
                                                        <div className="flex flex-wrap gap-2">
                                                            {(['daily', 'weekly', 'monthly'] as const).map((type) => (
                                                                <StandardButton
                                                                    key={type}
                                                                    variant={schedule.availability_type === type ? "primary" : "secondary"}
                                                                    size="md"
                                                                    onClick={() => {
                                                                        updateSchedule(index, {
                                                                            availability_type: type,
                                                                            day_configuration: type === 'daily' ? null : schedule.day_configuration
                                                                        });
                                                                    }}
                                                                >
                                                                    {type.charAt(0).toUpperCase() + type.slice(1)}
                                                                </StandardButton>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {/* Day Configuration for Weekly */}
                                                    {schedule.availability_type === 'weekly' && (
                                                        <div>
                                                            <div className="flex items-center justify-between mb-2">
                                                                <label className="block font-semibold text-sm text-neutral-800">
                                                                    Select Days
                                                                </label>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => selectAllWeekDays(index)}
                                                                    className={`text-xs font-medium px-2 py-1 rounded transition-colors ${
                                                                        ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].every(d => schedule.day_configuration?.includes(d))
                                                                            ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                                                            : `bg-${themeColor}-100 text-${fullColor} hover:bg-${themeColor}-200`
                                                                    }`}
                                                                >
                                                                    {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].every(d => schedule.day_configuration?.includes(d)) ? 'Deselect All' : 'Select All'}
                                                                </button>
                                                            </div>
                                                            <div className="flex flex-wrap gap-2">
                                                                {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => {
                                                                    const isSelected = schedule.day_configuration?.includes(day) || false;
                                                                    return (
                                                                        <StandardButton
                                                                            key={day}
                                                                            variant={isSelected ? "primary" : "secondary"}
                                                                            size="sm"
                                                                            onClick={() => {
                                                                                const current = schedule.day_configuration || [];
                                                                                const updated = isSelected
                                                                                    ? current.filter(d => d !== day)
                                                                                    : [...current, day];
                                                                                updateSchedule(index, { day_configuration: updated.length > 0 ? updated : null });
                                                                            }}
                                                                        >
                                                                            {day.charAt(0).toUpperCase() + day.slice(1)}
                                                                        </StandardButton>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Day Configuration for Monthly */}
                                                    {schedule.availability_type === 'monthly' && (
                                                        <div>
                                                            <label className="block font-semibold mb-2 text-sm text-neutral-800">
                                                                Select Occurrences
                                                            </label>
                                                            <div className="space-y-2 max-h-60 overflow-y-auto border border-gray-200 rounded-md p-3 bg-white">
                                                                {['first', 'second', 'third', 'fourth', 'last'].map(occurrence => 
                                                                    ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => {
                                                                        const value = `${occurrence}-${day}`;
                                                                        const isSelected = schedule.day_configuration?.includes(value) || false;
                                                                        return (
                                                                            <label key={value} className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-1 rounded">
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={isSelected}
                                                                                    onChange={() => {
                                                                                        const current = schedule.day_configuration || [];
                                                                                        const updated = isSelected
                                                                                            ? current.filter(d => d !== value)
                                                                                            : [...current, value];
                                                                                        updateSchedule(index, { day_configuration: updated.length > 0 ? updated : null });
                                                                                    }}
                                                                                    className="rounded border-gray-300"
                                                                                />
                                                                                <span className="text-sm">
                                                                                    {occurrence.charAt(0).toUpperCase() + occurrence.slice(1)} {day.charAt(0).toUpperCase() + day.slice(1)}
                                                                                </span>
                                                                            </label>
                                                                        );
                                                                    })
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Time Slot Configuration */}
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                        <div>
                                                            <label className="block text-xs font-medium text-gray-600 mb-1">Start Time</label>
                                                            <input
                                                                type="time"
                                                                value={schedule.time_slot_start}
                                                                onChange={(e) => updateSchedule(index, { time_slot_start: e.target.value })}
                                                                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-medium text-gray-600 mb-1">End Time</label>
                                                            <input
                                                                type="time"
                                                                value={schedule.time_slot_end}
                                                                onChange={(e) => updateSchedule(index, { time_slot_end: e.target.value })}
                                                                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-medium text-gray-600 mb-1">Interval (min)</label>
                                                            <input
                                                                type="number"
                                                                value={schedule.time_slot_interval}
                                                                onChange={(e) => updateSchedule(index, { time_slot_interval: parseInt(e.target.value) || 30 })}
                                                                onWheel={(e) => (e.target as HTMLInputElement).blur()}
                                                                min="15"
                                                                step="15"
                                                                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* Preview generated time slots */}
                                                    {((form.durationUnit === 'hours and minutes' && (form.durationHours || form.durationMinutes)) || (form.durationUnit !== 'hours and minutes' && form.duration)) && schedule.time_slot_start && schedule.time_slot_end && (
                                                        <div className="mt-3 pt-3 border-t border-gray-200">
                                                            <p className="text-xs font-medium text-gray-600 mb-2">Generated Time Slots:</p>
                                                            <div className="flex flex-wrap gap-1">
                                                                {(() => {
                                                                    // Calculate duration in minutes based on unit
                                                                    let slotDuration: number;
                                                                    if (form.durationUnit === 'hours and minutes') {
                                                                        const hours = parseInt(form.durationHours) || 0;
                                                                        const mins = parseInt(form.durationMinutes) || 0;
                                                                        slotDuration = hours * 60 + mins;
                                                                    } else if (form.durationUnit === 'hours') {
                                                                        slotDuration = parseInt(form.duration) * 60;
                                                                    } else {
                                                                        slotDuration = parseInt(form.duration);
                                                                    }
                                                                    const interval = schedule.time_slot_interval;
                                                                    const [startHour, startMin] = schedule.time_slot_start.split(':').map(Number);
                                                                    const [endHour, endMin] = schedule.time_slot_end.split(':').map(Number);
                                                                    let currentMinutes = startHour * 60 + startMin;
                                                                    const endMinutes = endHour * 60 + endMin;
                                                                    const slots = [];
                                                                    
                                                                    while (currentMinutes < endMinutes) {
                                                                        const slotEndMinutes = currentMinutes + slotDuration;
                                                                        if (slotEndMinutes <= endMinutes) {
                                                                            const startH = Math.floor(currentMinutes / 60);
                                                                            const startM = currentMinutes % 60;
                                                                            const endH = Math.floor(slotEndMinutes / 60);
                                                                            const endM = slotEndMinutes % 60;
                                                                            const startTime = `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`;
                                                                            const endTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
                                                                            slots.push(
                                                                                <span key={currentMinutes} className="px-2 py-1 bg-white border border-gray-200 rounded text-xs">
                                                                                    {formatTimeRange(startTime, endTime)}
                                                                                </span>
                                                                            );
                                                                        }
                                                                        currentMinutes += interval;
                                                                    }
                                                                    
                                                                    return slots.length > 0 ? slots : <span className="text-xs text-gray-500">No valid slots with current configuration</span>;
                                                                })()}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                
                                <StandardButton
                                    variant="secondary"
                                    size="lg"
                                    fullWidth
                                    onClick={addNewSchedule}
                                    icon={Plus}
                                    className="border-2 border-dashed"
                                >
                                    Add New Schedule
                                </StandardButton>
                            </div>
                        </div>
                        
                        <div className="border-b border-gray-100 my-2" />
                        
                        {/* Attractions Section */}
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className={`text-xl font-bold text-neutral-900 flex items-center gap-2`}>
                                    <Info className={`w-5 h-5 text-${themeColor}-600`} /> Attractions
                                </h3>
                                {attractions.length > 0 && (
                                    <StandardButton
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => {
                                            if (form.attractions.length === attractions.length) {
                                                setForm(prev => ({ ...prev, attractions: [] }));
                                            } else {
                                                setForm(prev => ({ ...prev, attractions: attractions.map(a => a.name) }));
                                            }
                                        }}
                                    >
                                        {form.attractions.length === attractions.length ? 'Deselect All' : 'Select All'}
                                    </StandardButton>
                                )}
                            </div>
                            {attractions.length === 0 ? (
                                <div className="bg-gray-50 rounded-lg p-4 text-center border border-dashed border-gray-300">
                                    <p className="text-gray-500 mb-3 text-sm">No attractions available yet</p>
                                    <Link
                                        to="/admin/attractions/create"
                                        className={`inline-flex items-center gap-2 bg-${fullColor} text-xs hover:bg-${themeColor}-900 text-white px-4 py-2 rounded-md transition`}
                                    >
                                        <Plus className="w-4 h-4" />
                                        Create Attraction
                                    </Link>
                                </div>
                            ) : (
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {attractions.map((act) => (
                                        <StandardButton
                                            key={act.name}
                                            variant={form.attractions.includes(act.name) ? "primary" : "secondary"}
                                            size="sm"
                                            className="rounded-full"
                                            onClick={() => handleMultiSelect("attractions", act.name)}
                                        >
                                            {act.name} <span className="text-xs opacity-70 ml-1">${act.price}</span>
                                        </StandardButton>
                                    ))}
                                </div>
                            )}
                        </div>
                        
                        {/* Rooms Section */}
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className={`text-xl font-bold text-neutral-900 flex items-center gap-2`}>
                                    <Home className={`w-5 h-5 text-${themeColor}-600`} /> Rooms
                                </h3>
                                {rooms.length > 0 && (
                                    <StandardButton
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => {
                                            if (form.rooms.length === rooms.length) {
                                                setForm(prev => ({ ...prev, rooms: [] }));
                                            } else {
                                                setForm(prev => ({ ...prev, rooms: rooms.map(r => r.name) }));
                                            }
                                        }}
                                    >
                                        {form.rooms.length === rooms.length ? 'Deselect All' : 'Select All'}
                                    </StandardButton>
                                )}
                            </div>
                            {/* Group rooms by area_group */}
                            {(() => {
                                const groupedRooms = rooms.reduce((acc, room) => {
                                    const group = room.area_group || 'Ungrouped';
                                    if (!acc[group]) acc[group] = [];
                                    acc[group].push(room);
                                    return acc;
                                }, {} as Record<string, typeof rooms>);
                                
                                const sortedGroups = Object.keys(groupedRooms).sort((a, b) => {
                                    if (a === 'Ungrouped') return 1;
                                    if (b === 'Ungrouped') return -1;
                                    return a.localeCompare(b);
                                });
                                
                                return sortedGroups.map(group => (
                                    <div key={group} className="mb-4">
                                        {sortedGroups.length > 1 && (
                                            <div className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                                                <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                                                {group}
                                            </div>
                                        )}
                                        <div className="flex flex-wrap gap-2">
                                            {[...groupedRooms[group]]
                                                .sort((a, b) =>
                                                    a.name.localeCompare(b.name, undefined, {
                                                        numeric: true,
                                                        sensitivity: "base",
                                                    })
                                                )
                                                .map((room) => (
                                                    <StandardButton
                                                        key={room.name}
                                                        variant={form.rooms.includes(room.name) ? "primary" : "secondary"}
                                                        size="sm"
                                                        className="rounded-full"
                                                        onClick={() => handleMultiSelect("rooms", room.name)}
                                                    >
                                                        {room.name}
                                                    </StandardButton>
                                                ))}
                                        </div>
                                    </div>
                                ));
                            })()}
                            <div className="flex gap-2 mt-2">
                                <input
                                    type="text"
                                    placeholder="Space name"
                                    className="rounded-md border border-gray-200 px-2 py-1 w-24 bg-white text-sm transition-all placeholder:text-gray-400"
                                    id="room-name"
                                />
                                <StandardButton
                                    variant="secondary"
                                    size="sm"
                                    icon={Plus}
                                    onClick={() => {
                                        const input = document.getElementById("room-name") as HTMLInputElement;
                                        handleAddOption("room", input?.value || "");
                                        if (input) input.value = "";
                                    }}
                                >
                                    Add
                                </StandardButton>
                            </div>
                        </div>
                        
                        {/* Add-ons Section */}
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className={`text-xl font-bold text-neutral-900 flex items-center gap-2`}>
                                    <Info className={`w-5 h-5 text-${themeColor}-600`} /> Add-ons
                                </h3>
                                {addOns.length > 0 && (
                                    <StandardButton
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => {
                                            if (form.addOns.length === addOns.length) {
                                                setForm(prev => ({ ...prev, addOns: [] }));
                                            } else {
                                                setForm(prev => ({ ...prev, addOns: addOns.map(a => a.name) }));
                                            }
                                        }}
                                    >
                                        {form.addOns.length === addOns.length ? 'Deselect All' : 'Select All'}
                                    </StandardButton>
                                )}
                            </div>
                            <div className="flex flex-wrap gap-2 mb-2">
                                {addOns.map((addon) => (
                                    <StandardButton
                                        key={addon.name}
                                        variant={form.addOns.includes(addon.name) ? "primary" : "secondary"}
                                        size="sm"
                                        className="rounded-full"
                                        onClick={() => handleMultiSelect("addOns", addon.name)}
                                    >
                                        {addon.name}
                                    </StandardButton>
                                ))}
                                <input
                                    type="text"
                                    placeholder="Add add-on"
                                    className="rounded-md border border-gray-200 px-2 py-1 w-20 bg-white text-sm transition-all placeholder:text-gray-400"
                                    id="addon-name"
                                />
                                <input
                                    type="number"
                                    placeholder="Price"
                                    className="rounded-md border border-gray-200 px-2 py-1 w-16 bg-white text-sm transition-all placeholder:text-gray-400"
                                    id="addon-price"
                                    min="0"
                                    onWheel={(e) => (e.target as HTMLInputElement).blur()}
                                />
                                <StandardButton
                                    variant="secondary"
                                    size="sm"
                                    icon={Plus}
                                    onClick={() => {
                                        const nameInput = document.getElementById("addon-name") as HTMLInputElement;
                                        const priceInput = document.getElementById("addon-price") as HTMLInputElement;
                                        handleAddOption("addon", nameInput?.value || "", "", priceInput?.value || "");
                                        if (nameInput) nameInput.value = "";
                                        if (priceInput) priceInput.value = "";
                                    }}
                                >
                                    Add
                                </StandardButton>
                            </div>
                            
                            {/* Selected Add-ons - Draggable Order */}
                            {form.addOns.length > 0 && (
                                <div className="mt-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Selected Add-ons Order <span className="text-xs font-normal text-gray-500">(drag to reorder)</span>
                                    </label>
                                    <div className="space-y-2 bg-gray-50 rounded-lg p-3">
                                        {form.addOns.map((addonName, index) => {
                                            const addon = addOns.find(a => a.name === addonName);
                                            return (
                                                <div
                                                    key={addonName}
                                                    className={`flex items-center gap-2 bg-white rounded-md p-2 border border-gray-200 ${draggedAddOnIndex === index ? 'opacity-50' : ''}`}
                                                    draggable
                                                    onDragStart={() => handleAddOnDragStart(index)}
                                                    onDragOver={(e) => handleAddOnDragOver(e, index)}
                                                    onDragEnd={handleAddOnDragEnd}
                                                >
                                                    <div className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600">
                                                        <GripVertical className="w-4 h-4" />
                                                    </div>
                                                    <span className="text-sm font-medium text-gray-600 w-6">{index + 1}.</span>
                                                    <span className="flex-1 text-sm text-neutral-800">{addonName}</span>
                                                    {addon && <span className="text-xs text-gray-500">${addon.price}</span>}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleMultiSelect("addOns", addonName)}
                                                        className="text-gray-400 hover:text-red-500 transition-colors"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        {/* Promos Section */}
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className={`text-xl font-bold text-neutral-900 flex items-center gap-2`}>
                                    <Tag className={`w-5 h-5 text-${themeColor}-600`} /> Promos
                                </h3>
                                {promos.length > 0 && (
                                    <StandardButton
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => {
                                            if (form.promos.length === promos.length) {
                                                setForm(prev => ({ ...prev, promos: [] }));
                                            } else {
                                                setForm(prev => ({ ...prev, promos: promos.map(p => p.code) }));
                                            }
                                        }}
                                    >
                                        {form.promos.length === promos.length ? 'Deselect All' : 'Select All'}
                                    </StandardButton>
                                )}
                            </div>
                            {promos.length === 0 ? (
                                <div className="text-sm text-gray-500 bg-gray-50 rounded-lg p-4 border border-gray-200">
                                    No active promos available. Create promos in the Promo Management section.
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {promos.map((promo) => (
                                        <label
                                            key={promo.code}
                                            className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={form.promos.includes(promo.code)}
                                                onChange={() => handleMultiSelectCheckbox('promos', promo.code)}
                                                className="mt-1"
                                            />
                                            <div className="flex-1">
                                                <div className="font-semibold text-neutral-900">{promo.name}</div>
                                                <div className="text-sm text-gray-500">Code: {promo.code}</div>
                                                {promo.description && (
                                                    <div className="text-sm text-gray-600 mt-1">{promo.description}</div>
                                                )}
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>
                        
                        {/* Gift Cards Section */}
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className={`text-xl font-bold text-neutral-900 flex items-center gap-2`}>
                                    <Gift className={`w-5 h-5 text-${themeColor}-600`} /> Gift Cards
                                </h3>
                                {giftCards.length > 0 && (
                                    <StandardButton
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => {
                                            if (form.giftCards.length === giftCards.length) {
                                                setForm(prev => ({ ...prev, giftCards: [] }));
                                            } else {
                                                setForm(prev => ({ ...prev, giftCards: giftCards.map(g => g.code) }));
                                            }
                                        }}
                                    >
                                        {form.giftCards.length === giftCards.length ? 'Deselect All' : 'Select All'}
                                    </StandardButton>
                                )}
                            </div>
                            {giftCards.length === 0 ? (
                                <div className="text-sm text-gray-500 bg-gray-50 rounded-lg p-4 border border-gray-200">
                                    No active gift cards available. Create gift cards in the Gift Card Management section.
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {giftCards.map((giftCard) => (
                                        <label
                                            key={giftCard.code}
                                            className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={form.giftCards.includes(giftCard.code)}
                                                onChange={() => handleMultiSelectCheckbox('giftCards', giftCard.code)}
                                                className="mt-1"
                                            />
                                            <div className="flex-1">
                                                <div className="font-semibold text-neutral-900">{giftCard.name}</div>
                                                <div className="text-sm text-gray-500">Code: {giftCard.code}</div>
                                                {giftCard.description && (
                                                    <div className="text-sm text-gray-600 mt-1">{giftCard.description}</div>
                                                )}
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>
                        
                        {/* Pricing Section */}
                        <div>
                            <h3 className={`text-xl font-bold mb-4 text-neutral-900 flex items-center gap-2`}>
                                <Info className={`w-5 h-5 text-${themeColor}-600`} /> Pricing
                            </h3>
                            <label className="block font-semibold mb-2 text-base text-neutral-800">Price</label>
                            <input
                                type="number"
                                name="price"
                                value={form.price}
                                onChange={handleChange}
                                onWheel={(e) => (e.target as HTMLInputElement).blur()}
                                className={`w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 bg-white text-neutral-900 text-base transition-all placeholder:text-gray-400`}
                                min="0"
                                step="0.01"
                                placeholder="Enter price"
                                required
                            />
                        </div>
                        
                        {/* Partial Payment Section */}
                        <div>
                            <h3 className={`text-xl font-bold mb-4 text-neutral-900 flex items-center gap-2 relative group`}>
                                <Info className={`w-5 h-5 text-${themeColor}-600`} /> Partial Payment Options
                                <span className="absolute z-20 left-0 top-full mt-2 min-w-[250px] max-w-xs bg-gray-900 text-white text-xs rounded-md px-3 py-2 opacity-0 group-hover:opacity-100 pointer-events-none transition-all">
                                    Configure partial payment options for customers (percentage or fixed amount)
                                </span>
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block font-semibold mb-2 text-base text-neutral-800">Partial Payment Percentage (%)</label>
                                    <input
                                        type="number"
                                        name="partialPaymentPercentage"
                                        value={form.partialPaymentPercentage}
                                        onChange={handleChange}
                                        onWheel={(e) => (e.target as HTMLInputElement).blur()}
                                        className={`w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 bg-white text-neutral-900 text-base transition-all placeholder:text-gray-400`}
                                        min="0"
                                        max="100"
                                        placeholder="e.g. 20 for 20%"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Leave 0 to disable percentage-based partial payment</p>
                                </div>
                                <div>
                                    <label className="block font-semibold mb-2 text-base text-neutral-800">Partial Payment Fixed Amount ($)</label>
                                    <input
                                        type="number"
                                        name="partialPaymentFixed"
                                        value={form.partialPaymentFixed}
                                        onChange={handleChange}
                                        onWheel={(e) => (e.target as HTMLInputElement).blur()}
                                        className={`w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 bg-white text-neutral-900 text-base transition-all placeholder:text-gray-400`}
                                        min="0"
                                        step="0.01"
                                        placeholder="e.g. 50 for $50"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Leave 0 to disable fixed amount partial payment</p>
                                </div>
                            </div>
                        </div>

                        {/* Guest of Honor Toggle */}
                        <div>
                            <h3 className={`text-xl font-bold mb-4 text-neutral-900 flex items-center gap-2`}>
                                <Gift className={`w-5 h-5 text-${themeColor}-600`} /> Guest of Honor
                            </h3>
                            <label className="flex items-center space-x-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={form.hasGuestOfHonor}
                                    onChange={(e) => setForm(prev => ({ ...prev, hasGuestOfHonor: e.target.checked }))}
                                    className={`w-5 h-5 rounded border-gray-300 text-${themeColor}-600 focus:ring-${themeColor}-500 cursor-pointer`}
                                />
                                <span className="text-base text-neutral-800">Enable guest of honor fields for this package</span>
                            </label>
                            <p className="text-xs text-gray-500 mt-2">When enabled, customers can specify the name, age, and gender of the guest of honor during booking.</p>
                        </div>
                        
                        <div className="flex gap-2 mt-6">
                            <StandardButton
                                type="submit"
                                variant="primary"
                                size="lg"
                                disabled={submitting || loading}
                                loading={submitting}
                                icon={Save}
                                className="flex-1"
                            >
                                {submitting ? 'Updating...' : 'Update Package'}
                            </StandardButton>
                            <Link
                                to="/packages"
                                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-2 rounded-md transition text-base flex items-center justify-center gap-2"
                            >
                                Cancel
                            </Link>
                        </div>
                    </form>
                </div>
            </div>
            
            {/* Live Preview Section */}
            <div className="w-full md:w-[420px] md:max-w-sm h-fit">
                <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6 md:p-8 shadow-none">
                    <h3 className="text-2xl font-bold mb-6 text-neutral-900 tracking-tight">Live Preview</h3>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className={`font-bold text-2xl text-${themeColor}-600 tracking-tight`}>{form.name || "Package Name"}</span>
                            <span className="text-lg text-gray-500 font-semibold">${form.price || "0"}</span>
                        </div>
                        <div className="text-xs text-gray-500 mb-2">{form.category || "Category"}</div>
                        
                        {/* Duration in Preview */}
                        <div className="mb-2 flex items-center gap-2">
                            <Clock className="w-4 h-4 text-gray-500" />
                            <span className="font-semibold">Duration:</span> 
                            <span className="text-neutral-800 text-sm">
                                {formatDuration()}
                            </span>
                        </div>
                        
                        {/* Availability in Preview */}
                        <div className="mb-2 flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-gray-500" />
                            <span className="font-semibold">Available:</span> 
                            <span className="text-neutral-800 text-sm">
                                {formatAvailability()}
                            </span>
                        </div>
                        
                        {/* Time Slots in Preview - show from availability schedules */}
                        <div className="mb-2 flex items-start gap-2">
                            <Clock className="w-4 h-4 text-gray-500 mt-0.5" />
                            <div className="flex-1">
                                <span className="font-semibold">Time Slots:</span>
                                <div className="text-neutral-800 text-sm mt-1">
                                    {form.availability_schedules.length > 0 ? (
                                        form.availability_schedules.map((schedule, idx) => (
                                            <div key={idx}>
                                                {formatTimeRange(schedule.time_slot_start, schedule.time_slot_end)} (every {schedule.time_slot_interval} min)
                                            </div>
                                        ))
                                    ) : form.timeSlotStart && form.timeSlotEnd && form.timeSlotInterval ? (
                                        <span>{formatTimeRange(form.timeSlotStart, form.timeSlotEnd)} (every {form.timeSlotInterval} min)</span>
                                    ) : (
                                        <span className="text-gray-400">Not configured</span>
                                    )}
                                </div>
                            </div>
                        </div>
                        
                        <div className="mb-4 text-neutral-800 text-base min-h-[48px]">{form.description || "Package description will appear here"}</div>
                        <div className="mb-2">
                            <span className="font-semibold">Attractions:</span> <span className="text-neutral-800 text-sm">{form.attractions.length > 0
                                ? form.attractions.join(", ")
                                : "No attractions selected"}</span>
                        </div>
                        <div className="mb-2">
                            <span className="font-semibold">SPACE:</span> <span className="text-neutral-800 text-sm">{form.rooms.length > 0
                                ? sortRoomsNumerically(form.rooms).join(", ")
                                : "No rooms selected"}</span>
                        </div>
                        <div className="mb-2">
                            <span className="font-semibold">Add-ons:</span> <span className="text-neutral-800 text-sm">{form.addOns.length > 0
                                ? form.addOns.join(", ")
                                : "No add-ons selected"}</span>
                        </div>
                        <div className="mb-2 flex items-center gap-2 flex-wrap">
                            <span className="font-semibold">Promos:</span>
                            {(form.promos || []).length ? (form.promos || []).map((code: string) => {
                                const promo = promos.find(p => p.code === code);
                                return promo ? (
                                    <span key={code} className={`px-2 py-1 bg-${themeColor}-100 text-${fullColor} text-xs rounded-md font-semibold`}>
                                        {promo.name}
                                    </span>
                                ) : null;
                            }) : <span className="text-neutral-800 text-sm">No promos selected</span>}
                        </div>
                        <div className="mb-2 flex items-center gap-2 flex-wrap">
                            <span className="font-semibold">Gift Cards:</span>
                            {(form.giftCards || []).length ? (form.giftCards || []).map((code: string) => {
                                const giftCard = giftCards.find(g => g.code === code);
                                return giftCard ? (
                                    <span key={code} className={`px-2 py-1 bg-${themeColor}-100 text-${fullColor} text-xs rounded-md font-semibold`}>
                                        {giftCard.name}
                                    </span>
                                ) : null;
                            }) : <span className="text-neutral-800 text-sm">No gift cards selected</span>}
                        </div>
                        {form.minParticipants && form.pricePerAdditional && parseFloat(form.pricePerAdditional) > 0 && (
                            <div className="mb-2">
                                <span className="font-semibold">Additional:</span> <span className="text-neutral-800 text-sm">${form.pricePerAdditional} per person after the {getOrdinal(parseInt(form.minParticipants))}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
    
            {/* Toast notification (top right) */}
            {toast && (
                <div className="fixed top-6 right-6 z-50 animate-fade-in-up">
                    <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
                </div>
            )}
        </div>
    );
};

export default EditPackage;
