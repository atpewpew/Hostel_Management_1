export type ItemType = "LOST" | "FOUND";

export type ItemCategory =
  | "Keys"
  | "Electronics"
  | "Documents/ID"
  | "Wallets/Bags"
  | "Clothing"
  | "Books/Stationery"
  | "Accessories"
  | "Other";

export type ItemStatus = "OPEN" | "CLAIMED" | "RESOLVED" | "EXPIRED";

export type ClaimStatus = "PENDING" | "ACCEPTED" | "REJECTED";

export interface ItemClaim {
  _id: string;
  claimantId: string;
  claimantName: string;
  claimantEmail: string;
  claimantRoom?: string | null;
  claimantHostel?: string | null;
  proofDescription: string;
  contactNumber?: string | null;
  status: ClaimStatus;
  createdAt: string;
}

export interface LostFoundItem {
  _id: string;
  title: string;
  description: string;
  type: ItemType;
  category: ItemCategory;
  itemImage?: string | null;
  location: string;
  date: string;
  collegeId: string;
  hostelId?: { _id: string; name: string } | string | null;
  reportedBy: {
    _id: string;
    name: string;
    email: string;
    roomNo?: string;
    role: string;
  };
  contactPreferences: {
    allowEmail: boolean;
    allowPhone: boolean;
    phoneNumber?: string | null;
    pickupLocation?: string | null;
  };
  verificationQuestion?: string | null;
  status: ItemStatus;
  claims?: ItemClaim[];
  claimCount?: number;
  hasUserClaimed?: boolean;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

