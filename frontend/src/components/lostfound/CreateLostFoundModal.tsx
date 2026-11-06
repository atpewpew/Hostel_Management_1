import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import apiClient from "@/lib/api-client";
import type { ItemCategory, ItemType } from "@/types/lostFound";
import { ImagePlus, X, HelpCircle, MapPin, Tag } from "lucide-react";

interface CreateLostFoundModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  initialType?: ItemType;
}

const CATEGORIES: ItemCategory[] = [
  "Keys",
  "Electronics",
  "Documents/ID",
  "Wallets/Bags",
  "Clothing",
  "Books/Stationery",
  "Accessories",
  "Other",
];

export function CreateLostFoundModal({
  isOpen,
  onClose,
  onCreated,
  initialType = "LOST",
}: CreateLostFoundModalProps) {
  const [type, setType] = useState<ItemType>(initialType);
  const [category, setCategory] = useState<ItemCategory>("Keys");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [pickupLocation, setPickupLocation] = useState("");
  const [verificationQuestion, setVerificationQuestion] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [allowPhone, setAllowPhone] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error("Image file must be under 10MB");
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !location.trim()) {
      toast.error("Please fill in all required fields.");
      return;
    }

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append("title", title.trim());
      formData.append("description", description.trim());
      formData.append("type", type);
      formData.append("category", category);
      formData.append("location", location.trim());

      if (pickupLocation.trim()) {
        formData.append("pickupLocation", pickupLocation.trim());
      }
      if (verificationQuestion.trim()) {
        formData.append("verificationQuestion", verificationQuestion.trim());
      }
      if (phoneNumber.trim()) {
        formData.append("phoneNumber", phoneNumber.trim());
      }
      formData.append("allowPhone", String(allowPhone));
      formData.append("allowEmail", "true");

      if (imageFile) {
        formData.append("itemImage", imageFile);
      }

      await apiClient.post("/lost-found", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      toast.success(
        type === "LOST"
          ? "Lost item report published successfully!"
          : "Found item report published successfully!"
      );

      // Reset
      setTitle("");
      setDescription("");
      setLocation("");
      setPickupLocation("");
      setVerificationQuestion("");
      setPhoneNumber("");
      setAllowPhone(false);
      removeImage();

      onCreated();
      onClose();
    } catch (err: any) {
      toast.error(
        err.response?.data?.message || "Failed to create item report."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {type === "LOST" ? "Report a Lost Item" : "Report a Found Item"}
          </DialogTitle>
          <DialogDescription>
            Help reunite items with their rightful owners across the campus.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto pr-2 py-2 space-y-4">
          {/* Type Toggle */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-lg">
            <button
              type="button"
              className={`py-2 text-sm font-medium rounded-md transition-all ${
                type === "LOST"
                  ? "bg-rose-500 text-white shadow"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setType("LOST")}
            >
              I Lost Something
            </button>
            <button
              type="button"
              className={`py-2 text-sm font-medium rounded-md transition-all ${
                type === "FOUND"
                  ? "bg-emerald-600 text-white shadow"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setType("FOUND")}
            >
              I Found Something
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="category" className="flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5" />
                Category *
              </Label>
              <Select
                value={category}
                onValueChange={(val) => setCategory(val as ItemCategory)}
              >
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select Category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="location" className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                {type === "LOST" ? "Last Seen Location *" : "Found Location *"}
              </Label>
              <Input
                id="location"
                placeholder="e.g. Mess Hall 2, Library 1st Floor"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="title">Item Title *</Label>
            <Input
              id="title"
              placeholder="e.g. Black Boat Airdopes with silicone case"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Detailed Description *</Label>
            <Textarea
              id="description"
              placeholder="Describe color, brand, distinct scratches, or any circumstances..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              required
            />
          </div>

          {/* Verification Question for Found items */}
          {type === "FOUND" && (
            <div className="space-y-1.5 rounded-lg border border-primary/20 bg-primary/5 p-3">
              <Label
                htmlFor="verificationQuestion"
                className="flex items-center gap-1.5 text-primary text-xs font-semibold"
              >
                <HelpCircle className="h-3.5 w-3.5" />
                Ownership Verification Question (Optional)
              </Label>
              <Input
                id="verificationQuestion"
                placeholder="e.g. What is the keychain shape? What brand is the cable?"
                value={verificationQuestion}
                onChange={(e) => setVerificationQuestion(e.target.value)}
                className="bg-background text-sm"
              />
              <p className="text-[11px] text-muted-foreground">
                Claimants must answer this to prove they are the real owner before you hand it over.
              </p>
            </div>
          )}

          {/* Drop-off / Handover info */}
          <div className="space-y-1.5">
            <Label htmlFor="pickupLocation">
              {type === "FOUND"
                ? "Current Custody / Drop-off Location"
                : "Preferred Return Location"}
            </Label>
            <Input
              id="pickupLocation"
              placeholder={
                type === "FOUND"
                  ? "e.g. Left with Security Gate 1, or Keep with me in Room 304"
                  : "e.g. Please leave at Warden Office Block A"
              }
              value={pickupLocation}
              onChange={(e) => setPickupLocation(e.target.value)}
            />
          </div>

          {/* Image Upload */}
          <div className="space-y-2">
            <Label>Item Photo (Optional but recommended)</Label>
            {imagePreview ? (
              <div className="relative inline-block rounded-lg overflow-hidden border">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="h-36 w-full max-w-sm object-cover"
                />
                <button
                  type="button"
                  onClick={removeImage}
                  className="absolute top-1.5 right-1.5 rounded-full bg-black/70 p-1 text-white hover:bg-black transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-4 cursor-pointer hover:bg-muted/40 transition-colors"
              >
                <ImagePlus className="h-8 w-8 text-muted-foreground mb-1" />
                <span className="text-xs text-muted-foreground">
                  Click to attach an image (PNG, JPG up to 10MB)
                </span>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png, image/jpeg, image/jpg"
              className="hidden"
              onChange={handleImageChange}
            />
          </div>

          {/* Contact options */}
          <div className="rounded-lg border p-3 space-y-3">
            <Label className="text-xs font-semibold">Contact Preferences</Label>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="allowPhone"
                checked={allowPhone}
                onChange={(e) => setAllowPhone(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <Label htmlFor="allowPhone" className="text-xs font-normal cursor-pointer">
                Allow students to view my phone number for quicker coordination
              </Label>
            </div>
            {allowPhone && (
              <Input
                placeholder="Your contact number (e.g. 9876543210)"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="text-xs"
              />
            )}
          </div>

          <DialogFooter className="pt-2 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className={type === "LOST" ? "bg-rose-600 hover:bg-rose-700" : "bg-emerald-600 hover:bg-emerald-700"}
            >
              {loading ? "Publishing..." : type === "LOST" ? "Post Lost Item" : "Post Found Item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

