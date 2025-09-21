import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getUserProfile, updateUserProfile } from "../services/authService";
import { useProfile } from "../contexts/ProfileContext";

interface UserProfile {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  company_name: string;
  profile_picture_url: string | null;
  display_name: string;
  gender?: string;
}

// Debounce utility function
function debounce<T extends (...args: any[]) => any>(func: T, wait: number): T {
  let timeout: NodeJS.Timeout;
  return ((...args: any[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  }) as T;
}

const ProfilePage: React.FC = () => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // setProfilePicture function from context
  const { setProfilePicture: setGlobalProfilePicture } = useProfile();

  // Form state
  const [formData, setFormData] = useState({
    username: "",
    first_name: "",
    last_name: "",
    phone_number: "",
    email: "",
    company_name: "",
    gender: "",
  });
  const [profilePicture, setProfilePicture] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const navigate = useNavigate();

  const fetchData = useCallback(async () => {
    try {
      const profileData = await getUserProfile();
      setProfile(profileData);
      setFormData({
        username: profileData.username || "",
        first_name: profileData.first_name || "",
        last_name: profileData.last_name || "",
        phone_number: profileData.phone_number || "",
        email: profileData.email || "",
        company_name: profileData.company_name || "",
        gender: profileData.gender || "", // support for gender field
      });
      setGlobalProfilePicture(profileData.profile_picture_url);
    } catch (err: any) {
      console.error("Profile fetch error:", err);
      if (err.response?.status === 404) {
        setError("Profile not found. Please contact support.");
      } else {
        setError("Failed to load profile data");
      }
    } finally {
      setIsLoading(false);
    }
  }, [setGlobalProfilePicture]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError("Profile picture must be less than 5MB");
        return;
      }
      const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
      ];
      if (!allowedTypes.includes(file.type)) {
        setError("Please upload a valid image file (JPEG, PNG, GIF, or WebP)");
        return;
      }
      setProfilePicture(file);
      // Create preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.username.trim()) {
      setError("Username is required");
      return;
    }
    if (!formData.email.trim()) {
      setError("Email is required");
      return;
    }
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const formDataToSend = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        formDataToSend.append(key, value.trim());
      });
      if (profilePicture) {
        formDataToSend.append("profile_picture", profilePicture);
      }
      const response = await updateUserProfile(formDataToSend);
      setSuccess("Profile updated successfully!");
      setProfile(response);
      setGlobalProfilePicture(response.profile_picture_url);
      setProfilePicture(null);
      setPreviewUrl(null);
    } catch (err: any) {
      console.error("Profile update error:", err);
      const errorMessage =
        err.response?.data?.username?.[0] ||
        err.response?.data?.email?.[0] ||
        err.response?.data?.error ||
        "Failed to update profile";
      setError(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-300">
            Loading profile...
          </p>
        </div>
      </div>
    );
  }

  const currentProfileImage =
    previewUrl ||
    profile?.profile_picture_url ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(
      profile?.display_name || "User"
    )}&size=120&background=3b82f6&color=fff`;

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
            Profile Settings
          </h1>
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
              {success}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Profile Picture */}
            <div className="flex items-center space-x-6">
              <div className="shrink-0">
                <img
                  src={currentProfileImage}
                  alt="Profile"
                  className="h-24 w-24 object-cover rounded-full border-2 border-gray-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Profile Picture
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                <p className="mt-1 text-xs text-gray-500">
                  PNG, JPG, GIF up to 5MB
                </p>
              </div>
            </div>
            {/* Username + Gender (grid row) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Username <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  required
                  className="h-12 pl-4 pr-10 mt-1 block w-full rounded-md 
      border border-gray-300 dark:border-gray-600 
      bg-white dark:bg-gray-700 text-gray-900 dark:text-white 
      shadow-sm appearance-none
      focus:border-blue-500 focus:ring-2 focus:ring-blue-500
      transition
    "
                />
              </div>
              {/* Gender (right) */}
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Gender
                </label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleInputChange}
                  className="h-12 pl-4 pr-10 mt-1 block w-full rounded-md 
      border border-gray-300 dark:border-gray-600 
      bg-white dark:bg-gray-700 text-gray-900 dark:text-white 
      shadow-sm appearance-none
      focus:border-blue-500 focus:ring-2 focus:ring-blue-500
      transition"
                >
                  <option value="" disabled>
                    Select gender
                  </option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </select>

                {/* Custom arrow icon */}
                <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
                  <svg
                    className="h-10 w-10 pt-5 text-gray-500 dark:text-gray-300"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M7 8l3 3 3-3" />
                  </svg>
                </div>
              </div>
            </div>
            {/* Personal Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  First Name
                </label>
                <input
                  type="text"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleInputChange}
                  className="h-12 pl-4 pr-10 mt-1 block w-full rounded-md 
      border border-gray-300 dark:border-gray-600 
      bg-white dark:bg-gray-700 text-gray-900 dark:text-white 
      shadow-sm appearance-none
      focus:border-blue-500 focus:ring-2 focus:ring-blue-500
      transition
    "
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Last Name
                </label>
                <input
                  type="text"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleInputChange}
                  className="h-12 pl-4 pr-10 mt-1 block w-full rounded-md 
      border border-gray-300 dark:border-gray-600 
      bg-white dark:bg-gray-700 text-gray-900 dark:text-white 
      shadow-sm appearance-none
      focus:border-blue-500 focus:ring-2 focus:ring-blue-500
      transition
    "
                />
              </div>
            </div>
            {/* Contact Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  className="h-12 pl-4 pr-10 mt-1 block w-full rounded-md 
      border border-gray-300 dark:border-gray-600 
      bg-white dark:bg-gray-700 text-gray-900 dark:text-white 
      shadow-sm appearance-none
      focus:border-blue-500 focus:ring-2 focus:ring-blue-500
      transition
    "
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Phone Number
                </label>
                <input
                  type="tel"
                  name="phone_number"
                  value={formData.phone_number}
                  onChange={handleInputChange}
                  className="h-12 pl-4 pr-10 mt-1 block w-full rounded-md 
      border border-gray-300 dark:border-gray-600 
      bg-white dark:bg-gray-700 text-gray-900 dark:text-white 
      shadow-sm appearance-none
      focus:border-blue-500 focus:ring-2 focus:ring-blue-500
      transition
    "
                />
              </div>
            </div>
            {/* Company Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Company Name
              </label>
              <input
                type="text"
                name="company_name"
                value={formData.company_name}
                onChange={handleInputChange}
                className="h-12 pl-4 pr-10 mt-1 block w-full rounded-md 
      border border-gray-300 dark:border-gray-600 
      bg-white dark:bg-gray-700 text-gray-900 dark:text-white 
      shadow-sm appearance-none
      focus:border-blue-500 focus:ring-2 focus:ring-blue-500
      transition
    "
              />
            </div>
            {/* Submit Button */}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                {isSaving ? "Saving..." : "Save Profile"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
