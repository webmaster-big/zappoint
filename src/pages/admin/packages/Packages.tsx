import React, { useEffect, useState } from "react";
import { ExternalLink, Link2, Calendar, Users, Tag, Gift } from "lucide-react";

const getPackages = () => {
  try {
    return JSON.parse(localStorage.getItem("zapzone_packages") || "[]");
  } catch {
    return [];
  }
};

const Packages: React.FC = () => {
  const [packages, setPackages] = useState<any[]>([]);
  const [filterCategory, setFilterCategory] = useState<string>("all");

  useEffect(() => {
    setPackages(getPackages());
  }, []);

  // Get unique categories for filtering
  const categories = ["all", ...new Set(packages.map(pkg => pkg.category).filter(Boolean))];

  // Filter packages by category
  const filteredPackages = filterCategory === "all" 
    ? packages 
    : packages.filter(pkg => pkg.category === filterCategory);

  // Helper for comma-joined or fallback
  const displayList = (arr?: any[], prop?: string) => {
    if (!arr || arr.length === 0) return <span className="text-gray-400 text-sm">None</span>;
    
    if (prop && arr[0] && typeof arr[0] === 'object') {
      return arr.map((item, i) => (
        <span key={i} className="text-sm text-gray-600">
          {item[prop]}{i < arr.length - 1 ? ', ' : ''}
        </span>
      ));
    }
    
    return <span className="text-sm text-gray-600">{arr.join(", ")}</span>;
  };

  // Format availability text
  const formatAvailability = (pkg: any) => {
    if (!pkg.availabilityType) return "Not specified";
    
    if (pkg.availabilityType === "daily") {
      if (!pkg.availableDays || pkg.availableDays.length === 0) return "No days selected";
      if (pkg.availableDays.length === 7) return "Every day";
      return pkg.availableDays.map((day: string) => day.substring(0, 3)).join(", ");
    } else if (pkg.availabilityType === "weekly") {
      if (!pkg.availableWeekDays || pkg.availableWeekDays.length === 0) return "No days selected";
      return pkg.availableWeekDays.map((day: string) => `Every ${day}`).join(", ");
    } else if (pkg.availabilityType === "monthly") {
      if (!pkg.availableMonthDays || pkg.availableMonthDays.length === 0) return "No days selected";
      return pkg.availableMonthDays.map((day: string) => {
        if (day === "last") return "Last day of month";
        const suffix = day === "1" ? "st" : day === "2" ? "nd" : day === "3" ? "rd" : "th";
        return `${day}${suffix}`;
      }).join(", ");
    }
    return "Not specified";
  };

  // Domain for booking links
//   or how about using an the url 
  const bookingDomain = window.location.origin; 

  return (
      <div className="w-full mx-auto px-4 pb-6 flex flex-col items-center">
        <div className="bg-white rounded-xl p-6 w-full shadow-sm border border-gray-100 mt-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">Packages</h2>
              <p className="text-gray-500 mt-1">Manage and view all your packages</p>
            </div>
          </div>

          {/* Filter Section */}
          {categories.length > 1 && (
            <div className="mb-6 flex flex-wrap gap-2">
              {categories.map((category) => (
                <button 
                  key={category}
                  className={`px-3 py-1.5 rounded-full text-sm ${filterCategory === category ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-600"}`}
                  onClick={() => setFilterCategory(category)}
                >
                  {category === "all" ? "All" : category}
                </button>
              ))}
            </div>
          )}

          {/* Packages Grid */}
          {filteredPackages.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPackages.map((pkg, idx) => (
                <div key={idx} className="border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-semibold text-lg text-gray-900 truncate">{pkg.name || "Unnamed Package"}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm text-gray-500">{pkg.category || "No category"}</span>
                        <span className="text-lg font-semibold text-blue-700">${pkg.price || "0"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mb-4">
                    <p className="text-sm text-gray-600 line-clamp-2">{pkg.description || "No description"}</p>
                  </div>

                  <div className="grid gap-3 mb-4">
                    {pkg.features && (
                      <div className="flex items-start gap-2">
                        <Tag className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                        <div className="text-sm">
                          <span className="font-medium">Features: </span>
                          <span className="text-gray-600">{pkg.features}</span>
                        </div>
                      </div>
                    )}

                    <div className="flex items-start gap-2">
                      <Calendar className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div className="text-sm">
                        <span className="font-medium">Availability: </span>
                        <span className="text-gray-600">{formatAvailability(pkg)}</span>
                      </div>
                    </div>

                    {pkg.maxParticipants && (
                      <div className="flex items-start gap-2">
                        <Users className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                        <div className="text-sm">
                          <span className="font-medium">Max Participants: </span>
                          <span className="text-gray-600">{pkg.maxParticipants}</span>
                          {pkg.pricePerAdditional && (
                            <span className="text-gray-600"> (${pkg.pricePerAdditional} per additional)</span>
                          )}
                        </div>
                      </div>
                    )}

                    {pkg.attractions && pkg.attractions.length > 0 && (
                      <div className="flex items-start gap-2">
                        <div className="w-4 h-4 flex-shrink-0" />
                        <div className="text-sm">
                          <span className="font-medium">Attractions: </span>
                          {displayList(pkg.attractions)}
                        </div>
                      </div>
                    )}

                    {pkg.addOns && pkg.addOns.length > 0 && (
                      <div className="flex items-start gap-2">
                        <div className="w-4 h-4 flex-shrink-0" />
                        <div className="text-sm">
                          <span className="font-medium">Add-ons: </span>
                          {displayList(pkg.addOns, 'name')}
                        </div>
                      </div>
                    )}

                    {pkg.promos && pkg.promos.length > 0 && (
                      <div className="flex items-start gap-2">
                        <Tag className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                        <div className="text-sm">
                          <span className="font-medium">Promos: </span>
                          {displayList(pkg.promos, 'name')}
                        </div>
                      </div>
                    )}

                    {pkg.giftCards && pkg.giftCards.length > 0 && (
                      <div className="flex items-start gap-2">
                        <Gift className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                        <div className="text-sm">
                          <span className="font-medium">Gift Cards: </span>
                          {displayList(pkg.giftCards, 'name')}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Booking Links */}
                  <div className="border-t border-gray-100 pt-4 mt-2">
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-col gap-1">
                        <div className="inline-flex items-center gap-1 text-sm font-medium text-gray-700">
                          <Link2 className="w-4 h-4" /> Embed Link
                        </div>
                        <div className="text-xs text-blue-700 break-all bg-blue-50 rounded px-2 py-1.5 border border-blue-100">
                          {`${bookingDomain}/book/embed?id=${pkg.id}`}
                        </div>
                      </div>
                      
                      <div className="flex flex-col gap-1">
                        <div className="inline-flex items-center gap-1 text-sm font-medium text-gray-700">
                          <ExternalLink className="w-4 h-4" /> Booking Page
                        </div>
                        <div className="text-xs text-blue-700 break-all bg-blue-50 rounded px-2 py-1.5 border border-blue-100">
                          {`${bookingDomain}/book/package/${pkg.id}`}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 border border-dashed border-gray-300 rounded-xl">
              <div className="text-gray-400 mb-2">No packages found</div>
              <p className="text-gray-500 text-sm mb-4">{filterCategory !== "all" ? `No packages in the "${filterCategory}" category` : "Create your first package to get started"}</p>
            </div>
          )}
        </div>
      </div>
  );
};

export default Packages;