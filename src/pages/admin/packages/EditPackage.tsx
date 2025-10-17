import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import Toast from "../../../components/ui/Toast";
import { Info, Plus, Calendar, Clock, Gift, Tag, Home, ArrowLeft, Save } from "lucide-react";
import type { PackagesPackage } from '../../../types/Packages.types';
import type { 
    CreatePackageAttraction, 
    CreatePackageAddOn, 
    CreatePackageRoom,
    CreatePackagePromo,
    CreatePackageGiftCard
} from '../../../types/createPackage.types';

// Mock data tables (simulate fetch)
const initialAttractions = ["Laser Tag", "Arcade", "Bowling", "Axe Throwing", "Party Room"];
const initialAddOns = [
    { name: "Pizza", price: 350 },
    { name: "Soda", price: 50 },
    { name: "Extra Game", price: 100 }
];
const initialCategories = ["Birthday", "Special", "Event", "Arcade Party", "Corporate", "Other"];
const initialRooms = [
    { name: "Main Hall" },
    { name: "VIP Room" },
    { name: "Party Room A" },
    { name: "Party Room B" },
    { name: "Conference Room" }
];

// Get active promos and gift cards from localStorage
const getActivePromos = (): CreatePackagePromo[] => {
    try {
        const promos = JSON.parse(localStorage.getItem("zapzone_promos") || "[]");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return promos.filter((p: any) => p.status === "active" && !p.deleted);
    } catch {
        return [];
    }
};

const getActiveGiftCards = (): CreatePackageGiftCard[] => {
    try {
        const giftCards = JSON.parse(localStorage.getItem("zapzone_giftcards") || "[]");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return giftCards.filter((gc: any) => gc.status === "active" && !gc.deleted);
    } catch {
        return [];
    }
};

const EditPackage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    
    // Option tables (simulate fetch)
    const [attractions, setAttractions] = useState<CreatePackageAttraction[]>(() => {
        const stored = localStorage.getItem("zapzone_attractions");
        if (stored) return JSON.parse(stored);
        // If old format, convert
        if (Array.isArray(initialAttractions) && typeof initialAttractions[0] === "string") {
            return initialAttractions.map((name) => ({ name, price: 0 }));
        }
        return initialAttractions;
    });
    const [addOns, setAddOns] = useState<CreatePackageAddOn[]>(() => JSON.parse(localStorage.getItem("zapzone_addons") || JSON.stringify(initialAddOns)));
    const [categories, setCategories] = useState<string[]>(() => JSON.parse(localStorage.getItem("zapzone_categories") || JSON.stringify(initialCategories)));
    const [rooms, setRooms] = useState<CreatePackageRoom[]>(() => JSON.parse(localStorage.getItem("zapzone_rooms") || JSON.stringify(initialRooms)));
    const [promos, setPromos] = useState<CreatePackagePromo[]>(getActivePromos);
    const [giftCards, setGiftCards] = useState<CreatePackageGiftCard[]>(getActiveGiftCards);

    // Form state
    const [form, setForm] = useState({
        name: "",
        description: "",
        category: "",
        features: "",
        attractions: [] as string[],
        rooms: [] as string[],
        price: "",
        maxParticipants: "",
        pricePerAdditional: "",
        duration: "",
        durationUnit: "hours" as "hours" | "minutes",
        promos: [] as string[], // will store promo.code
        giftCards: [] as string[], // will store giftCard.code
        addOns: [] as string[],
        availabilityType: "daily" as "daily" | "weekly" | "monthly",
        availableDays: [] as string[],
        availableWeekDays: [] as string[],
        availableMonthDays: [] as string[],
        image: "" as string, // base64 or data url
    });

    // Image preview state
    const [imagePreview, setImagePreview] = useState<string>("");

    // Load package data
    useEffect(() => {
        const loadPackage = () => {
            try {
                const packages: PackagesPackage[] = JSON.parse(localStorage.getItem("zapzone_packages") || "[]");
                const pkg = packages.find((p: PackagesPackage) => p.id === id);
                
                if (!pkg) {
                    setNotFound(true);
                    setLoading(false);
                    return;
                }

                // Extract promo codes and gift card codes from objects
                const promoCodes = pkg.promos?.map(p => p.code) || [];
                const giftCardCodes = pkg.giftCards?.map(g => g.code) || [];
                const addOnNames = pkg.addOns?.map(a => a.name) || [];
                const roomNames = pkg.rooms?.map(r => r.name) || [];

                setForm({
                    name: pkg.name || "",
                    description: pkg.description || "",
                    category: pkg.category || "",
                    features: pkg.features || "",
                    attractions: pkg.attractions || [],
                    rooms: roomNames,
                    price: String(pkg.price || ""),
                    maxParticipants: String(pkg.maxParticipants || ""),
                    pricePerAdditional: String(pkg.pricePerAdditional || ""),
                    duration: String(pkg.duration || ""),
                    durationUnit: pkg.durationUnit || "hours",
                    promos: promoCodes,
                    giftCards: giftCardCodes,
                    addOns: addOnNames,
                    availabilityType: pkg.availabilityType || "daily",
                    availableDays: pkg.availableDays || [],
                    availableWeekDays: pkg.availableWeekDays || [],
                    availableMonthDays: pkg.availableMonthDays || [],
                    image: pkg.image || "",
                });

                if (pkg.image) {
                    setImagePreview(pkg.image);
                }

                setLoading(false);
            } catch (error) {
                console.error("Error loading package:", error);
                setNotFound(true);
                setLoading(false);
            }
        };

        loadPackage();
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

    // Handle availability selection
    const handleAvailabilityChange = (type: "daily" | "weekly" | "monthly", value: string) => {
        if (type === "daily") {
            setForm(prev => {
                const days = prev.availableDays.includes(value)
                    ? prev.availableDays.filter(d => d !== value)
                    : [...prev.availableDays, value];
                return { ...prev, availableDays: days };
            });
        } else if (type === "weekly") {
            setForm(prev => {
                const days = prev.availableWeekDays.includes(value)
                    ? prev.availableWeekDays.filter(d => d !== value)
                    : [...prev.availableWeekDays, value];
                return { ...prev, availableWeekDays: days };
            });
        } else if (type === "monthly") {
            setForm(prev => {
                const days = prev.availableMonthDays.includes(value)
                    ? prev.availableMonthDays.filter(d => d !== value)
                    : [...prev.availableMonthDays, value];
                return { ...prev, availableMonthDays: days };
            });
        }
    };

    // Add option with code and description for promos/gift cards
    const handleAddOption = (type: string, value: string, code?: string, extra?: string, unit?: string) => {
        if (!value.trim() || ((type === 'promo' || type === 'giftcard') && !code?.trim())) return;
        switch(type) {
            case 'activity': {
                const price = Number(extra) || 0;
                const attractionUnit = unit || '';
                if (!attractions.some(a => a.name === value)) {
                    const updated = [...attractions, { name: value, price, unit: attractionUnit }];
                    setAttractions(updated);
                    localStorage.setItem("zapzone_attractions", JSON.stringify(updated));
                    showToast("Attraction added!", "success");
                }
                break;
            }
            case 'addon':
                if (!addOns.some(a => a.name === value)) {
                    const price = Number(extra) || 0;
                    const updated = [...addOns, { name: value, price }];
                    setAddOns(updated);
                    localStorage.setItem("zapzone_addons", JSON.stringify(updated));
                    showToast("Add-on added!", "success");
                }
                break;
            case 'category':
                if (!categories.includes(value)) {
                    const updated = [...categories, value];
                    setCategories(updated);
                    localStorage.setItem("zapzone_categories", JSON.stringify(updated));
                    showToast("Category added!", "success");
                }
                break;
            case 'room':
                if (!rooms.some(r => r.name === value)) {
                    const updated = [...rooms, { name: value }];
                    setRooms(updated);
                    localStorage.setItem("zapzone_rooms", JSON.stringify(updated));
                    showToast("Room added!", "success");
                }
                break;
            case 'promo':
                if (!promos.some(p => p.name === value)) {
                    const description = extra || '';
                    const updated = [...promos, { name: value, code: code || '', description }];
                    setPromos(updated);
                    localStorage.setItem("zapzone_promos", JSON.stringify(updated));
                    showToast("Promo added!", "success");
                }
                break;
            case 'giftcard':
                if (!giftCards.some(g => g.name === value)) {
                    const description = extra || '';
                    const updated = [...giftCards, { name: value, code: code || '', description }];
                    setGiftCards(updated);
                    localStorage.setItem("zapzone_giftcards", JSON.stringify(updated));
                    showToast("Gift card added!", "success");
                }
                break;
        }
    };

    // On submit, update the package in localStorage
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        try {
            // Get existing packages
            const packages: PackagesPackage[] = JSON.parse(localStorage.getItem("zapzone_packages") || "[]");
            const packageIndex = packages.findIndex((p: PackagesPackage) => p.id === id);

            if (packageIndex === -1) {
                showToast("Package not found!", "error");
                return;
            }

            // Save a copy of the form, but promos/giftCards/addOns as objects with code/description/price
            const promoObjs = form.promos.map(code => promos.find(p => p.code === code)).filter((p): p is CreatePackagePromo => p !== undefined);
            const giftCardObjs = form.giftCards.map(code => giftCards.find(g => g.code === code)).filter((g): g is CreatePackageGiftCard => g !== undefined);
            const addOnObjs = form.addOns.map(name => addOns.find(a => a.name === name)).filter((a): a is CreatePackageAddOn => a !== undefined);
            const roomObjs = form.rooms.map(name => rooms.find(r => r.name === name)).filter((r): r is CreatePackageRoom => r !== undefined);

            const updatedPackage = {
                ...packages[packageIndex],
                ...form,
                promos: promoObjs,
                giftCards: giftCardObjs,
                addOns: addOnObjs,
                rooms: roomObjs,
                pricePerAdditional: form.pricePerAdditional,
                image: form.image,
            };

            // Update and save
            packages[packageIndex] = updatedPackage;
            localStorage.setItem("zapzone_packages", JSON.stringify(packages));
            showToast("Package updated successfully!", "success");
            
            // Navigate back after a short delay
            setTimeout(() => {
                navigate("/packages");
            }, 1000);
        } catch (error) {
            console.error("Error updating package:", error);
            showToast("Error updating package!", "error");
        }
    };

    // Format availability for display
    const formatAvailability = () => {
        if (form.availabilityType === "daily") {
            if (form.availableDays.length === 0) return "No days selected";
            if (form.availableDays.length === 7) return "Every day";
            return form.availableDays.map(day => day.substring(0, 3)).join(", ");
        } else if (form.availabilityType === "weekly") {
            if (form.availableWeekDays.length === 0) return "No days selected";
            return form.availableWeekDays.map(day => `Every ${day}`).join(", ");
        } else if (form.availabilityType === "monthly") {
            if (form.availableMonthDays.length === 0) return "No days selected";
            return form.availableMonthDays.map(day => {
                if (day === "last") return "Last day of month";
                const suffix = day === "1" ? "st" : day === "2" ? "nd" : day === "3" ? "rd" : "th";
                return `${day}${suffix}`;
            }).join(", ");
        }
        return "Not specified";
    };

    // Format duration for display
    const formatDuration = () => {
        if (!form.duration) return "Not specified";
        return `${form.duration} ${form.durationUnit}`;
    };

    // Loading state
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading package...</p>
                </div>
            </div>
        );
    }

    // Not found state
    if (notFound) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">Package Not Found</h2>
                    <p className="text-gray-600 mb-6">The package you're looking for doesn't exist.</p>
                    <Link
                        to="/packages"
                        className="inline-flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white px-6 py-2 rounded-lg font-semibold"
                    >
                        <ArrowLeft size={18} />
                        Back to Packages
                    </Link>
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
                                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-800 hover:file:bg-blue-100"
                            />
                            {imagePreview && (
                                <div className="mt-4">
                                    <img src={imagePreview} alt="Preview" className="w-full max-h-56 object-contain rounded-md border border-gray-200" />
                                </div>
                            )}
                        </div>

                        {/* Details Section */}
                        <div>
                            <h3 className="text-xl font-bold mb-4 text-neutral-900 flex items-center gap-2">
                                <Info className="w-5 h-5 text-primary" /> Details
                            </h3>
                            <div className="space-y-5">
                                <div>
                                    <label className="block font-semibold mb-2 text-base text-neutral-800">Package Name</label>
                                    <input
                                        type="text"
                                        name="name"
                                        value={form.name}
                                        onChange={handleChange}
                                        className="w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-primary focus:border-primary bg-white text-neutral-900 text-base transition-all placeholder:text-gray-400"
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
                                        className="w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-primary focus:border-primary bg-white text-neutral-900 text-base transition-all placeholder:text-gray-400"
                                        placeholder="Enter package description"
                                    />
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block font-semibold mb-2 text-base text-neutral-800">Category</label>
                                        <select
                                            name="category"
                                            value={form.category}
                                            onChange={handleChange}
                                            className="w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-primary focus:border-primary bg-white text-neutral-900 text-base transition-all"
                                        >
                                            <option value="">Select category</option>
                                            {categories.map((cat) => (
                                                <option key={cat} value={cat}>{cat}</option>
                                            ))}
                                        </select>
                                    </div>
                                    
                                    <div>
                                        <label className="block font-semibold mb-2 text-base text-neutral-800">Max Participants</label>
                                        <input
                                            type="number"
                                            name="maxParticipants"
                                            value={form.maxParticipants}
                                            onChange={handleChange}
                                            className="w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-primary focus:border-primary bg-white text-neutral-900 text-base transition-all placeholder:text-gray-400"
                                            min="0"
                                            placeholder="Enter max participants"
                                        />
                                    </div>
                                </div>
                                
                                {form.maxParticipants && (
                                    <div>
                                        <label className="block font-semibold mb-2 text-base text-neutral-800">Price per Additional Participant</label>
                                        <input
                                            type="number"
                                            name="pricePerAdditional"
                                            value={form.pricePerAdditional}
                                            onChange={handleChange}
                                            className="w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-primary focus:border-primary bg-white text-neutral-900 text-base transition-all placeholder:text-gray-400"
                                            min="0"
                                            placeholder="Enter price per additional participant"
                                        />
                                    </div>
                                )}
                                
                                <div>
                                    <label className="block font-semibold mb-2 text-base text-neutral-800">Duration</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="number"
                                            name="duration"
                                            value={form.duration}
                                            onChange={handleChange}
                                            className="flex-1 rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-primary focus:border-primary bg-white text-neutral-900 text-base transition-all placeholder:text-gray-400"
                                            min="0"
                                            placeholder="Enter duration"
                                        />
                                        <select
                                            name="durationUnit"
                                            value={form.durationUnit}
                                            onChange={handleChange}
                                            className="rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-primary focus:border-primary bg-white text-neutral-900 text-base transition-all"
                                        >
                                            <option value="hours">Hours</option>
                                            <option value="minutes">Minutes</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block font-semibold mb-2 text-base text-neutral-800">Features</label>
                                    <textarea
                                        name="features"
                                        value={form.features}
                                        onChange={handleChange}
                                        rows={3}
                                        className="w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-primary focus:border-primary bg-white text-neutral-900 text-base transition-all placeholder:text-gray-400"
                                        placeholder="Enter package features (comma-separated)"
                                    />
                                </div>
                            </div>
                        </div>
                        
                        {/* Availability Section */}
                        <div>
                            <h3 className="text-xl font-bold mb-4 text-neutral-900 flex items-center gap-2">
                                <Calendar className="w-5 h-5 text-primary" /> Availability
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block font-semibold mb-2 text-base text-neutral-800">Availability Type</label>
                                    <select
                                        name="availabilityType"
                                        value={form.availabilityType}
                                        onChange={handleChange}
                                        className="w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-primary focus:border-primary bg-white text-neutral-900 text-base transition-all"
                                    >
                                        <option value="daily">Daily</option>
                                        <option value="weekly">Weekly</option>
                                        <option value="monthly">Monthly</option>
                                    </select>
                                </div>
                                
                                {form.availabilityType === "daily" && (
                                    <div>
                                        <label className="block font-semibold mb-2 text-base text-neutral-800">Available Days</label>
                                        <div className="flex flex-wrap gap-2">
                                            {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day) => (
                                                <button
                                                    key={day}
                                                    type="button"
                                                    onClick={() => handleAvailabilityChange("daily", day)}
                                                    className={`px-4 py-2 rounded-md text-sm font-semibold transition-all ${
                                                        form.availableDays.includes(day)
                                                            ? "bg-blue-700 text-white"
                                                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                                    }`}
                                                >
                                                    {day}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                
                                {form.availabilityType === "weekly" && (
                                    <div>
                                        <label className="block font-semibold mb-2 text-base text-neutral-800">Available Week Days</label>
                                        <div className="flex flex-wrap gap-2">
                                            {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day) => (
                                                <button
                                                    key={day}
                                                    type="button"
                                                    onClick={() => handleAvailabilityChange("weekly", day)}
                                                    className={`px-4 py-2 rounded-md text-sm font-semibold transition-all ${
                                                        form.availableWeekDays.includes(day)
                                                            ? "bg-blue-700 text-white"
                                                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                                    }`}
                                                >
                                                    Every {day}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                
                                {form.availabilityType === "monthly" && (
                                    <div>
                                        <label className="block font-semibold mb-2 text-base text-neutral-800">Available Month Days</label>
                                        <div className="flex flex-wrap gap-2">
                                            {[...Array(31)].map((_, i) => {
                                                const day = String(i + 1);
                                                return (
                                                    <button
                                                        key={day}
                                                        type="button"
                                                        onClick={() => handleAvailabilityChange("monthly", day)}
                                                        className={`px-3 py-2 rounded-md text-sm font-semibold transition-all ${
                                                            form.availableMonthDays.includes(day)
                                                                ? "bg-blue-700 text-white"
                                                                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                                        }`}
                                                    >
                                                        {day}
                                                    </button>
                                                );
                                            })}
                                            <button
                                                type="button"
                                                onClick={() => handleAvailabilityChange("monthly", "last")}
                                                className={`px-3 py-2 rounded-md text-sm font-semibold transition-all ${
                                                    form.availableMonthDays.includes("last")
                                                        ? "bg-blue-700 text-white"
                                                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                                }`}
                                            >
                                                Last
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        <div className="border-b border-gray-100 my-2" />
                        
                        {/* Attractions Section */}
                        <div>
                            <h3 className="text-xl font-bold mb-4 text-neutral-900 flex items-center gap-2">
                                <Info className="w-5 h-5 text-primary" /> Attractions
                            </h3>
                            <div className="flex flex-wrap gap-2 mb-2">
                                {attractions.map((attraction) => (
                                    <button
                                        key={attraction.name}
                                        type="button"
                                        onClick={() => handleMultiSelect("attractions", attraction.name)}
                                        className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-all ${
                                            form.attractions.includes(attraction.name)
                                                ? "bg-blue-700 text-white"
                                                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                        }`}
                                    >
                                        {attraction.name}
                                    </button>
                                ))}
                                <input
                                    type="text"
                                    placeholder="Add attraction"
                                    className="rounded-md border border-gray-200 px-2 py-1 w-28 bg-white text-sm transition-all placeholder:text-gray-400"
                                    id="activity-name"
                                />
                                <input
                                    type="number"
                                    placeholder="Price"
                                    className="rounded-md border border-gray-200 px-2 py-1 w-16 bg-white text-sm transition-all placeholder:text-gray-400"
                                    id="activity-price"
                                    min="0"
                                />
                                <input
                                    type="text"
                                    placeholder="Unit (e.g. per person, per table)"
                                    className="rounded-md border border-gray-200 px-2 py-1 w-32 bg-white text-sm transition-all placeholder:text-gray-400"
                                    id="activity-unit"
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        const nameInput = document.getElementById("activity-name") as HTMLInputElement;
                                        const priceInput = document.getElementById("activity-price") as HTMLInputElement;
                                        const unitInput = document.getElementById("activity-unit") as HTMLInputElement;
                                        handleAddOption("activity", nameInput?.value || "", "", priceInput?.value || "", unitInput?.value || "");
                                        if (nameInput) nameInput.value = "";
                                        if (priceInput) priceInput.value = "";
                                        if (unitInput) unitInput.value = "";
                                    }}
                                    className="px-3 py-1.5 bg-blue-50 text-blue-800 rounded-md text-sm font-semibold hover:bg-blue-100 transition-all flex items-center gap-1"
                                >
                                    <Plus className="w-4 h-4" /> Add
                                </button>
                            </div>
                        </div>
                        
                        {/* Rooms Section */}
                        <div>
                            <h3 className="text-xl font-bold mb-4 text-neutral-900 flex items-center gap-2">
                                <Home className="w-5 h-5 text-primary" /> Rooms
                            </h3>
                            <div className="flex flex-wrap gap-2 mb-2">
                                {rooms.map((room) => (
                                    <button
                                        key={room.name}
                                        type="button"
                                        onClick={() => handleMultiSelect("rooms", room.name)}
                                        className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-all ${
                                            form.rooms.includes(room.name)
                                                ? "bg-blue-700 text-white"
                                                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                        }`}
                                    >
                                        {room.name}
                                    </button>
                                ))}
                                <input
                                    type="text"
                                    placeholder="Room name"
                                    className="rounded-md border border-gray-200 px-2 py-1 w-24 bg-white text-sm transition-all placeholder:text-gray-400"
                                    id="room-name"
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        const input = document.getElementById("room-name") as HTMLInputElement;
                                        handleAddOption("room", input?.value || "");
                                        if (input) input.value = "";
                                    }}
                                    className="px-3 py-1.5 bg-blue-50 text-blue-800 rounded-md text-sm font-semibold hover:bg-blue-100 transition-all flex items-center gap-1"
                                >
                                    <Plus className="w-4 h-4" /> Add
                                </button>
                            </div>
                        </div>
                        
                        {/* Add-ons Section */}
                        <div>
                            <h3 className="text-xl font-bold mb-4 text-neutral-900 flex items-center gap-2">
                                <Info className="w-5 h-5 text-primary" /> Add-ons
                            </h3>
                            <div className="flex flex-wrap gap-2 mb-2">
                                {addOns.map((addon) => (
                                    <button
                                        key={addon.name}
                                        type="button"
                                        onClick={() => handleMultiSelect("addOns", addon.name)}
                                        className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-all ${
                                            form.addOns.includes(addon.name)
                                                ? "bg-blue-700 text-white"
                                                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                        }`}
                                    >
                                        {addon.name}
                                    </button>
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
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        const nameInput = document.getElementById("addon-name") as HTMLInputElement;
                                        const priceInput = document.getElementById("addon-price") as HTMLInputElement;
                                        handleAddOption("addon", nameInput?.value || "", "", priceInput?.value || "");
                                        if (nameInput) nameInput.value = "";
                                        if (priceInput) priceInput.value = "";
                                    }}
                                    className="px-3 py-1.5 bg-blue-50 text-blue-800 rounded-md text-sm font-semibold hover:bg-blue-100 transition-all flex items-center gap-1"
                                >
                                    <Plus className="w-4 h-4" /> Add
                                </button>
                            </div>
                        </div>
                        
                        {/* Promos Section */}
                        <div>
                            <h3 className="text-xl font-bold mb-4 text-neutral-900 flex items-center gap-2">
                                <Tag className="w-5 h-5 text-primary" /> Promos
                            </h3>
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
                            <h3 className="text-xl font-bold mb-4 text-neutral-900 flex items-center gap-2">
                                <Gift className="w-5 h-5 text-primary" /> Gift Cards
                            </h3>
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
                            <h3 className="text-xl font-bold mb-4 text-neutral-900 flex items-center gap-2">
                                <Info className="w-5 h-5 text-primary" /> Pricing
                            </h3>
                            <label className="block font-semibold mb-2 text-base text-neutral-800">Price</label>
                            <input
                                type="number"
                                name="price"
                                value={form.price}
                                onChange={handleChange}
                                className="w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-primary focus:border-primary bg-white text-neutral-900 text-base transition-all placeholder:text-gray-400"
                                min="0"
                                placeholder="Enter price"
                                required
                            />
                        </div>
                        
                        <div className="flex gap-2 mt-6">
                            <button
                                type="submit"
                                className="flex-1 bg-blue-800 hover:bg-blue-900 text-white font-semibold py-2 rounded-md transition text-base flex items-center justify-center gap-2"
                            >
                                <Save className="w-5 h-5" /> Update Package
                            </button>
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
            <div className="w-full md:w-[420px] md:max-w-sm md:sticky md:top-1 h-fit">
                <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6 md:p-8 shadow-none">
                    <h3 className="text-2xl font-bold mb-6 text-neutral-900 tracking-tight">Live Preview</h3>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="font-bold text-2xl text-primary tracking-tight">{form.name || "Package Name"}</span>
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
                        
                        <div className="mb-4 text-neutral-800 text-base min-h-[48px]">{form.description || "Package description will appear here"}</div>
                        <div className="mb-2">
                            <span className="font-semibold">Attractions:</span> <span className="text-neutral-800 text-sm">{form.attractions.length > 0
                                ? form.attractions.join(", ")
                                : "No attractions selected"}</span>
                        </div>
                        <div className="mb-2">
                            <span className="font-semibold">Rooms:</span> <span className="text-neutral-800 text-sm">{form.rooms.length > 0
                                ? form.rooms.join(", ")
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
                                    <span key={code} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-md font-semibold">
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
                                    <span key={code} className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-md font-semibold">
                                        {giftCard.name}
                                    </span>
                                ) : null;
                            }) : <span className="text-neutral-800 text-sm">No gift cards selected</span>}
                        </div>
                        {form.maxParticipants && form.pricePerAdditional && (
                            <div className="mb-2">
                                <span className="font-semibold">Additional:</span> <span className="text-neutral-800 text-sm">${form.pricePerAdditional} per participant after {form.maxParticipants}</span>
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
