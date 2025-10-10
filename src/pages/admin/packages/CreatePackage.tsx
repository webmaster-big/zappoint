import React, { useState } from "react";
import Toast from "../../../components/ui/Toast";
import { Info, Plus, RefreshCcw, Calendar, Clock, Gift, Tag, Home } from "lucide-react";
import { useNavigate } from "react-router-dom";

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
const getActivePromos = () => {
    try {
        const promos = JSON.parse(localStorage.getItem("zapzone_promos") || "[]");
        return promos.filter((p: any) => p.status === "active" && !p.deleted);
    } catch {
        return [];
    }
};

const getActiveGiftCards = () => {
    try {
        const giftCards = JSON.parse(localStorage.getItem("zapzone_giftcards") || "[]");
        return giftCards.filter((gc: any) => gc.status === "active" && !gc.deleted);
    } catch {
        return [];
    }
};

const CreatePackage: React.FC = () => {
    const navigate = useNavigate();
    
    // Option tables (simulate fetch)
    type Attraction = { name: string; price: number; unit?: string };
    const [attractions, setAttractions] = useState<Attraction[]>(() => {
        const stored = localStorage.getItem("zapzone_attractions");
        if (stored) return JSON.parse(stored);
        // If old format, convert
        if (Array.isArray(initialAttractions) && typeof initialAttractions[0] === "string") {
            return initialAttractions.map((name) => ({ name, price: 0 }));
        }
        return initialAttractions;
    });
    const [addOns, setAddOns] = useState<{ name: string; price: number }[]>(() => JSON.parse(localStorage.getItem("zapzone_addons") || JSON.stringify(initialAddOns)));
    const [categories, setCategories] = useState<string[]>(() => JSON.parse(localStorage.getItem("zapzone_categories") || JSON.stringify(initialCategories)));
    const [rooms, setRooms] = useState<{ name: string }[]>(() => JSON.parse(localStorage.getItem("zapzone_rooms") || JSON.stringify(initialRooms)));
    const [promos, setPromos] = useState<{ name: string; code: string; description: string }[]>(getActivePromos);
    const [giftCards, setGiftCards] = useState<{ name: string; code: string; description: string }[]>(getActiveGiftCards);

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

    // On submit, save form data to localStorage (append to zapzone_packages)
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Get existing packages
        const existing = JSON.parse(localStorage.getItem("zapzone_packages") || "[]");
        // Save a copy of the form, but promos/giftCards/addOns as objects with code/description/price
        const promoObjs = form.promos.map(code => promos.find(p => p.code === code)).filter(Boolean);
        const giftCardObjs = form.giftCards.map(code => giftCards.find(g => g.code === code)).filter(Boolean);
        const addOnObjs = form.addOns.map(name => addOns.find(a => a.name === name)).filter(Boolean);
        const roomObjs = form.rooms.map(name => rooms.find(r => r.name === name)).filter(Boolean);

        // Generate a temporary unique id
        const tempId = `pkg_${Date.now()}_${Math.floor(Math.random() * 100000)}`;

        const newPackage = {
            id: tempId,
            ...form,
            promos: promoObjs,
            giftCards: giftCardObjs,
            addOns: addOnObjs,
            rooms: roomObjs,
            pricePerAdditional: form.pricePerAdditional,
            image: form.image,
        };

        // Append and save
        localStorage.setItem("zapzone_packages", JSON.stringify([...existing, newPackage]));
        showToast("Package saved!", "success");
        setForm({
            name: "",
            description: "",
            category: "",
            features: "",
            attractions: [],
            rooms: [],
            price: "",
            maxParticipants: "",
            pricePerAdditional: "",
            duration: "",
            durationUnit: "hours",
            promos: [],
            giftCards: [],
            addOns: [],
            availabilityType: "daily",
            availableDays: [],
            availableWeekDays: [],
            availableMonthDays: [],
            image: "",
        });
        setImagePreview("");
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

    return (
            <div className="w-full mx-auto sm:px-4 md:mt-8 pb-6 flex flex-col md:flex-row gap-8 md:gap-12">
                {/* Form Section */}
                <div className="flex-1 mx-auto">
                    <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 md:p-8">
                        <h2 className="text-2xl sm:text-3xl font-bold text-neutral-900 tracking-tight">Create Package Deal</h2>
                        <p className="text-sm text-gray-500 mb-8 mt-2">Fill in the details below to create a new package deal.</p>    
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
                                    
                                    {/* Duration Section */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block font-semibold mb-2 text-base text-neutral-800">Duration</label>
                                            <div className="flex gap-2">
                                                <input
                                                    type="number"
                                                    name="duration"
                                                    value={form.duration}
                                                    onChange={handleChange}
                                                    className="w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-primary focus:border-primary bg-white text-neutral-900 text-base transition-all placeholder:text-gray-400"
                                                    min="1"
                                                    placeholder="Duration"
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
                                            <label className="block font-semibold mb-2 text-base text-neutral-800">Max Participants</label>
                                            <input
                                                type="number"
                                                name="maxParticipants"
                                                value={form.maxParticipants}
                                                onChange={handleChange}
                                                className="w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-primary focus:border-primary bg-white text-neutral-900 text-base transition-all placeholder:text-gray-400"
                                                min="1"
                                                placeholder="Enter max participants"
                                            />
                                        </div>
                                    </div>
                                    
                                    {/* Additional Pricing Section */}
                                    {form.maxParticipants && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block font-semibold mb-2 text-base text-neutral-800">Price per Additional Participant</label>
                                                <input
                                                    type="number"
                                                    name="pricePerAdditional"
                                                    value={form.pricePerAdditional}
                                                    onChange={handleChange}
                                                    className="w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-primary focus:border-primary bg-white text-neutral-900 text-base transition-all placeholder:text-gray-400"
                                                    min="0"
                                                    placeholder="Enter price for each additional participant"
                                                />
                                            </div>
                                        </div>
                                    )}
                                    
                                    <div>
                                        <label className="block font-semibold mb-2 text-base text-neutral-800">Category</label>
                                        <div className="flex flex-col sm:flex-row gap-2">
                                            <select
                                                name="category"
                                                value={form.category}
                                                onChange={handleChange}
                                                className="rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-primary focus:border-primary bg-white text-neutral-900 text-base min-w-0 flex-1 transition-all"
                                                required
                                            >
                                                <option value="">Select category</option>
                                                {categories.map((cat) => (
                                                    <option key={cat} value={cat}>{cat}</option>
                                                ))}
                                            </select>
                                            <div className="flex gap-1 items-center">
                                                <input
                                                    type="text"
                                                    placeholder="Add category"
                                                    className="rounded-md border border-gray-200 px-3 py-2 bg-white text-base min-w-0 w-32 transition-all"
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            handleAddOption('category', (e.target as HTMLInputElement).value);
                                                            (e.target as HTMLInputElement).value = '';
                                                        }
                                                    }}
                                                />
                                                <button type="button" className="p-2 rounded-md hover:bg-gray-100 transition" title="Add category">
                                                    <Plus className="w-4 h-4 text-primary" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    {/* Features input below category */}
                                    <div>
                                        <label className="block font-semibold mb-2 text-base text-neutral-800">Features</label>
                                        <input
                                            type="text"
                                            name="features"
                                            value={form.features}
                                            onChange={handleChange}
                                            className="w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-primary focus:border-primary bg-white text-neutral-900 text-base transition-all placeholder:text-gray-400"
                                            placeholder="e.g. Free drinks, VIP room, etc."
                                        />
                                    </div>
                                    <div>
                                        <label className="block font-semibold mb-2 text-base text-neutral-800">Description</label>
                                        <textarea
                                            name="description"
                                            value={form.description}
                                            onChange={handleChange}
                                            className="w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-primary focus:border-primary bg-white text-neutral-900 text-base transition-all placeholder:text-gray-400"
                                            rows={3}
                                            placeholder="Describe the package"
                                            required
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
                                        <label className="block font-semibold mb-2 text-base text-neutral-800">Schedule Type</label>
                                        <div className="flex flex-wrap gap-4">
                                            <label className="flex items-center gap-2">
                                                <input
                                                    type="radio"
                                                    name="availabilityType"
                                                    value="daily"
                                                    checked={form.availabilityType === "daily"}
                                                    onChange={handleChange}
                                                    className="accent-primary"
                                                />
                                                <span>Daily</span>
                                            </label>
                                            <label className="flex items-center gap-2">
                                                <input
                                                    type="radio"
                                                    name="availabilityType"
                                                    value="weekly"
                                                    checked={form.availabilityType === "weekly"}
                                                    onChange={handleChange}
                                                    className="accent-primary"
                                                />
                                                <span>Weekly</span>
                                            </label>
                                            <label className="flex items-center gap-2">
                                                <input
                                                    type="radio"
                                                    name="availabilityType"
                                                    value="monthly"
                                                    checked={form.availabilityType === "monthly"}
                                                    onChange={handleChange}
                                                    className="accent-primary"
                                                />
                                                <span>Monthly</span>
                                            </label>
                                        </div>
                                    </div>
                                    
                                    {form.availabilityType === "daily" && (
                                        <div>
                                            <label className="block font-semibold mb-2 text-base text-neutral-800">Available Days</label>
                                            <div className="flex flex-wrap gap-2">
                                                {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(day => (
                                                    <button
                                                        type="button"
                                                        key={day}
                                                        className={`px-3 py-1.5 rounded-full border text-sm font-medium transition-all duration-150 hover:bg-primary/10 hover:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/30 ${form.availableDays.includes(day) ? "bg-primary/10 border-primary text-primary" : "bg-white border-gray-200 text-neutral-800"}`}
                                                        onClick={() => handleAvailabilityChange("daily", day)}
                                                    >
                                                        {day.substring(0, 3)}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    
                                    {form.availabilityType === "weekly" && (
                                        <div>
                                            <label className="block font-semibold mb-2 text-base text-neutral-800">Available On</label>
                                            <div className="flex flex-wrap gap-2">
                                                {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(day => (
                                                    <button
                                                        type="button"
                                                        key={day}
                                                        className={`px-3 py-1.5 rounded-full border text-sm font-medium transition-all duration-150 hover:bg-primary/10 hover:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/30 ${form.availableWeekDays.includes(day) ? "bg-primary/10 border-primary text-primary" : "bg-white border-gray-200 text-neutral-800"}`}
                                                        onClick={() => handleAvailabilityChange("weekly", day)}
                                                    >
                                                        {day.substring(0, 3)}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    
                                    {form.availabilityType === "monthly" && (
                                        <div>
                                            <label className="block font-semibold mb-2 text-base text-neutral-800">Available On</label>
                                            <div className="flex flex-wrap gap-2">
                                                {["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23", "24", "25", "26", "27", "28", "last"].map(day => (
                                                    <button
                                                        type="button"
                                                        key={day}
                                                        className={`px-3 py-1.5 rounded-full border text-sm font-medium transition-all duration-150 hover:bg-primary/10 hover:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/30 ${form.availableMonthDays.includes(day) ? "bg-primary/10 border-primary text-primary" : "bg-white border-gray-200 text-neutral-800"}`}
                                                        onClick={() => handleAvailabilityChange("monthly", day)}
                                                    >
                                                        {day === "last" ? "Last" : day}
                                                    </button>
                                                ))}
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
                                    {attractions.map((act) => (
                                        <button
                                            type="button"
                                            key={act.name}
                                            className={`px-3 py-1 rounded-full border text-sm font-medium transition-all duration-150 hover:bg-primary/10 hover:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/30 ${form.attractions.includes(act.name) ? "bg-primary/10 border-primary text-primary" : "bg-white border-gray-200 text-neutral-800"}`}
                                            onClick={() => handleMultiSelect("attractions", act.name)}
                                        >
                                            {act.name} <span className="text-xs text-gray-400 ml-1">${act.price}</span>
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
                                    <button type="button" className="p-2 rounded-md hover:bg-gray-100 transition" title="Add attraction"
                                        onClick={() => {
                                            const nameInput = document.getElementById('activity-name') as HTMLInputElement;
                                            const priceInput = document.getElementById('activity-price') as HTMLInputElement;
                                            const unitInput = document.getElementById('activity-unit') as HTMLInputElement;
                                            if (nameInput.value) {
                                                handleAddOption('activity', nameInput.value, undefined, priceInput.value, unitInput.value);
                                                nameInput.value = '';
                                                priceInput.value = '';
                                                unitInput.value = '';
                                            }
                                        }}
                                    >
                                        <Plus className="w-4 h-4 text-primary" />
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
                                            type="button"
                                            key={room.name}
                                            className={`px-3 py-1 rounded-full border text-sm font-medium transition-all duration-150 hover:bg-blue-50 hover:border-blue-400/60 focus:outline-none focus:ring-2 focus:ring-blue-200 ${form.rooms.includes(room.name) ? "bg-blue-50 border-blue-400 text-blue-800" : "bg-white border-gray-200 text-neutral-800"}`}
                                            onClick={() => handleMultiSelect("rooms", room.name)}
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
                                    <button type="button" className="p-2 rounded-md hover:bg-blue-50 transition" title="Add room"
                                        onClick={() => {
                                            const nameInput = document.getElementById('room-name') as HTMLInputElement;
                                            if (nameInput.value) {
                                                handleAddOption('room', nameInput.value);
                                                nameInput.value = '';
                                            }
                                        }}
                                    >
                                        <Plus className="w-4 h-4 text-blue-600" />
                                    </button>
                                </div>
                            </div>
                            
                            {/* Add-ons Section */}
                            <div>
                                <h3 className="text-xl font-bold mb-4 text-neutral-900 flex items-center gap-2">
                                    <Info className="w-5 h-5 text-primary" /> Add-ons
                                </h3>
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {addOns.map((add) => (
                                        <button
                                            type="button"
                                            key={add.name}
                                            className={`px-3 py-1 rounded-full border text-sm font-medium flex items-center gap-2 transition-all duration-150 hover:bg-emerald-50 hover:border-emerald-400/60 focus:outline-none focus:ring-2 focus:ring-emerald-200 ${form.addOns.includes(add.name) ? "bg-emerald-50 border-emerald-400 text-emerald-800" : "bg-white border-gray-200 text-neutral-800"}`}
                                            onClick={() => handleMultiSelect("addOns", add.name)}
                                        >
                                            {add.name} <span className="text-xs text-gray-500">${add.price}</span>
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
                                    <button type="button" className="p-2 rounded-md hover:bg-emerald-50 transition" title="Add add-on"
                                        onClick={() => {
                                            const nameInput = document.getElementById('addon-name') as HTMLInputElement;
                                            const priceInput = document.getElementById('addon-price') as HTMLInputElement;
                                            if (nameInput.value) {
                                                handleAddOption('addon', nameInput.value, priceInput.value);
                                                nameInput.value = '';
                                                priceInput.value = '';
                                            }
                                        }}
                                    >
                                        <Plus className="w-4 h-4 text-emerald-600" />
                                    </button>
                                </div>
                            </div>
                            
                            {/* Promos Section */}
                            <div>
                                <h3 className="text-xl font-bold mb-4 text-neutral-900 flex items-center gap-2">
                                    <Tag className="w-5 h-5 text-primary" /> Promos
                                </h3>
                                {promos.length === 0 ? (
                                    <div className="bg-gray-50 rounded-lg p-4 text-center border border-dashed border-gray-300">
                                        <p className="text-gray-500 mb-3 text-sm">No promos available yet</p>
                                        <button
                                            type="button"
                                            onClick={() => navigate('/packages/promos')}
                                            className="inline-flex items-center gap-2 bg-blue-800 text-xs hover:bg-blue-800 text-white px-4 py-2 rounded-md transition"
                                        >
                                            <Plus className="w-4 h-4" />
                                            Create Promo
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex flex-wrap gap-2 items-center mb-2">
                                        {promos.map((promo) => (
                                            <label key={promo.code} className={`flex items-center gap-2 px-3 py-1 rounded-full border cursor-pointer text-sm font-medium transition-all duration-150 hover:bg-primary/10 hover:border-primary/60 focus-within:ring-2 focus-within:ring-primary/30 ${form.promos.includes(promo.code) ? "bg-primary/10 border-primary text-primary" : "bg-white border-gray-200 text-neutral-800"}`}>
                                                <input
                                                    type="checkbox"
                                                    checked={form.promos.includes(promo.code)}
                                                    onChange={() => handleMultiSelectCheckbox('promos', promo.code)}
                                                    className="accent-indigo-500"
                                                />
                                                <span className="relative group cursor-pointer flex items-center gap-1">
                                                    {promo.name}
                                                    <span className="text-xs text-gray-400 ml-1">[{promo.code}]</span>
                                                    {promo.description && (
                                                        <span className="ml-1">
                                                            <Info className="w-4 h-4 text-gray-400 group-hover:text-primary transition" />
                                                            <span className="absolute z-20 left-1/2 -translate-x-1/2 bottom-full mb-2 min-w-[180px] max-w-xs bg-white border border-gray-200 shadow-lg text-gray-900 text-xs rounded-md px-3 py-2 opacity-0 group-hover:opacity-100 pointer-events-none transition-all whitespace-pre-line text-left content-fit">
                                                                {promo.description}
                                                            </span>
                                                        </span>
                                                    )}
                                                </span>
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
                                    <div className="bg-gray-50 rounded-lg p-4 text-center border border-dashed border-gray-300">
                                        <p className="text-gray-500 mb-3 text-sm">No gift cards available yet</p>
                                        <button
                                            type="button"
                                            onClick={() => navigate('/packages/gift-cards')}
                                            className="inline-flex items-center gap-2 bg-blue-800 text-xs hover:bg-blue-800 text-white px-4 py-2 rounded-md transition"
                                        >
                                            <Plus className="w-4 h-4" />
                                            Create Gift Card
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex flex-wrap gap-2 items-center mb-2">
                                        {giftCards.map((gc) => (
                                            <label key={gc.code} className={`flex items-center gap-2 px-3 py-1 rounded-full border cursor-pointer text-sm font-medium transition-all duration-150 hover:bg-emerald-50 hover:border-emerald-400/60 focus-within:ring-2 focus-within:ring-emerald-200 ${form.giftCards.includes(gc.code) ? "bg-emerald-50 border-emerald-400 text-emerald-800" : "bg-white border-gray-200 text-neutral-800"}`}>
                                                <input
                                                    type="checkbox"
                                                    checked={form.giftCards.includes(gc.code)}
                                                    onChange={() => handleMultiSelectCheckbox('giftCards', gc.code)}
                                                    className="accent-emerald-500"
                                                />
                                                <span className="relative group cursor-pointer flex items-center gap-1">
                                                    {gc.name}
                                                    <span className="text-xs text-gray-400 ml-1">[{gc.code}]</span>
                                                    {gc.description && (
                                                        <span className="ml-1">
                                                            <Info className="w-4 h-4 text-emerald-400 group-hover:text-emerald-800 transition" />
                                                            <span className="absolute z-20 left-1/2 -translate-x-1/2 bottom-full mb-2 min-w-[180px] max-w-xs bg-white border border-gray-200 shadow-lg text-gray-900 text-xs rounded-md px-3 py-2 opacity-0 group-hover:opacity-100 pointer-events-none transition-all whitespace-pre-line text-left content-fit">
                                                                {gc.description}
                                                            </span>
                                                        </span>
                                                    )}
                                                </span>
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
                                    className="flex-1 bg-blue-800 hover:bg-blue-800 text-white font-semibold py-2 rounded-md transition text-base flex items-center justify-center gap-2 visible"
                                >
                                    <Plus className="w-5 h-5" /> Submit
                                </button>
                                <button
                                    type="button"
                                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-2 rounded-md transition text-base flex items-center justify-center gap-2"
                                    onClick={() => setForm({
                                        name: "",
                                        description: "",
                                        category: "",
                                        features: "",
                                        attractions: [],
                                        rooms: [],
                                        price: "",
                                        maxParticipants: "",
                                        pricePerAdditional: "",
                                        duration: "",
                                        durationUnit: "hours",
                                        promos: [],
                                        giftCards: [],
                                        addOns: [],
                                        availabilityType: "daily",
                                        availableDays: [],
                                        availableWeekDays: [],
                                        availableMonthDays: [],
                                        image: "",
                                    })}
                                >
                                    <RefreshCcw className="w-5 h-5" /> Reset
                                </button>
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
                                <span className="font-bold text-2xl text-primary tracking-tight">{form.name || <span className='text-gray-400'>Package Name</span>}</span>
                                <span className="text-lg text-gray-500 font-semibold">${form.price || '--'}</span>
                            </div>
                            <div className="text-xs text-gray-500 mb-2">{form.category || <span className='text-gray-300'>Category</span>}</div>
                            
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
                            
                            {/* Additional Time Pricing in Preview */}
                            
                            <div className="mb-4 text-neutral-800 text-base min-h-[48px]">{form.description || <span className='text-gray-300'>Description</span>}</div>
                            <div className="mb-2">
                                <span className="font-semibold">Attractions:</span> <span className="text-neutral-800 text-sm">{(form.attractions || []).length ? form.attractions.map((act: string) => {
                                    const found = attractions.find(a => a.name === act);
                                    return found ? `${found.name} ($${found.price}${found.unit ? `, ${found.unit}` : ''})` : act;
                                }).join(", ") : <span className='text-gray-300'>None</span>}</span>
                            </div>
                            <div className="mb-2">
                                <span className="font-semibold">Rooms:</span> <span className="text-neutral-800 text-sm">{(form.rooms || []).length ? form.rooms.map((room: string) => {
                                    const found = rooms.find(r => r.name === room);
                                    return found ? found.name : room;
                                }).join(", ") : <span className='text-gray-300'>None</span>}</span>
                            </div>
                            <div className="mb-2">
                                <span className="font-semibold">Add-ons:</span> <span className="text-neutral-800 text-sm">{(form.addOns || []).length ? (form.addOns || []).map((add: string) => {
                                    const found = addOns.find(a => a.name === add);
                                    return found ? `${found.name} ($${found.price})` : add;
                                }).join(", ") : <span className='text-gray-300'>None</span>}</span>
                            </div>
                            <div className="mb-2 flex items-center gap-2 flex-wrap">
                                <span className="font-semibold">Promos:</span>
                                {(form.promos || []).length ? (form.promos || []).map((code: string) => {
                                    const found = promos.find(p => p.code === code);
                                    return found ? (
                                        <span key={code} className="relative group cursor-pointer text-primary flex items-center gap-1">
                                            {found.name}
                                            {found.code && <span className="ml-1 text-gray-400">[{found.code}]</span>}
                                            {found.description && (
                                                <span className="ml-1">
                                                    <Info className="w-4 h-4 text-primary group-hover:text-primary/80 transition" />
                                                    <span className="absolute z-20 left-1/2 -translate-x-1/2 bottom-full mb-2 min-w-[180px] max-w-xs bg-white border border-gray-200 shadow-lg text-gray-900 text-xs rounded-md px-3 py-2 opacity-0 group-hover:opacity-100 pointer-events-none transition-all whitespace-pre-line text-left content-fit">
                                                        {found.description}
                                                    </span>
                                                </span>
                                            )}
                                        </span>
                                    ) : null;
                                }) : <span className='text-gray-300'>None</span>}
                            </div>
                            <div className="mb-2 flex items-center gap-2 flex-wrap">
                                <span className="font-semibold">Gift Cards:</span>
                                {(form.giftCards || []).length ? (form.giftCards || []).map((code: string) => {
                                    const found = giftCards.find(g => g.code === code);
                                    return found ? (
                                        <span key={code} className="relative group cursor-pointer text-emerald-800 flex items-center gap-1">
                                            {found.name}
                                            {found.code && <span className="ml-1 text-gray-400">[{found.code}]</span>}
                                            {found.description && (
                                                <span className="ml-1">
                                                    <Info className="w-4 h-4 text-emerald-400 group-hover:text-emerald-800 transition" />
                                                    <span className="absolute z-20 left-1/2 -translate-x-1/2 bottom-full mb-2 min-w-[180px] max-w-xs bg-white border border-gray-200 shadow-lg text-gray-900 text-xs rounded-md px-3 py-2 opacity-0 group-hover:opacity-100 pointer-events-none transition-all whitespace-pre-line text-left content-fit">
                                                        {found.description}
                                                    </span>
                                                </span>
                                            )}
                                        </span>
                                    ) : null;
                                }) : <span className='text-gray-300'>None</span>}
                            </div>
                            {form.maxParticipants && form.pricePerAdditional && (
                                <div className="mb-2">
                                    <span className="font-semibold">Price per Additional Participant:</span> <span className="text-neutral-800 text-sm">${form.pricePerAdditional}</span>
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

export default CreatePackage;