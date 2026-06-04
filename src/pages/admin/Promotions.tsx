import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Edit,
  Trash2,
  ArrowLeft,
  Tag,
  Zap
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const API_URL = import.meta.env.VITE_BACKEND_URL;

interface Promotion {
  id: string;
  name: string;
  description?: string;
  multiplier: number;
  start_date: string;
  end_date: string;
  product_ids?: string[];
  active: boolean;
}

const AdminPromotions = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    multiplier: "2",
    start_date: "",
    end_date: "",
  });

  useEffect(() => {
    checkAuth();
    fetchPromotions();
  }, []);

  const checkAuth = () => {
    const token = localStorage.getItem("admin_token");
    if (!token) {
      navigate("/admin/login");
    }
  };

  const getAuthHeaders = () => {
    const token = localStorage.getItem("admin_token");
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  };

  const fetchPromotions = async () => {
    try {
      const response = await fetch(`${API_URL}/api/promotions`);
      const data = await response.json();
      setPromotions(data);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch promotions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (promotion?: Promotion) => {
    if (promotion) {
      setEditingPromotion(promotion);
      setFormData({
        name: promotion.name,
        description: promotion.description || "",
        multiplier: promotion.multiplier.toString(),
        start_date: new Date(promotion.start_date).toISOString().slice(0, 16),
        end_date: new Date(promotion.end_date).toISOString().slice(0, 16),
      });
    } else {
      setEditingPromotion(null);
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      setFormData({
        name: "",
        description: "",
        multiplier: "2",
        start_date: now.toISOString().slice(0, 16),
        end_date: tomorrow.toISOString().slice(0, 16),
      });
    }
    setShowDialog(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const promotionData = {
      name: formData.name,
      description: formData.description || undefined,
      multiplier: parseInt(formData.multiplier),
      start_date: new Date(formData.start_date).toISOString(),
      end_date: new Date(formData.end_date).toISOString(),
      product_ids: null, // Apply to all products
    };

    try {
      const url = editingPromotion
        ? `${API_URL}/api/promotions/${editingPromotion.id}`
        : `${API_URL}/api/promotions`;
      
      const method = editingPromotion ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(promotionData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to save promotion");
      }

      toast({
        title: "Success",
        description: `Promotion ${editingPromotion ? "updated" : "created"} successfully`,
      });

      setShowDialog(false);
      fetchPromotions();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (promotionId: string) => {
    if (!confirm("Are you sure you want to delete this promotion?")) return;

    try {
      const response = await fetch(`${API_URL}/api/promotions/${promotionId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error("Failed to delete promotion");
      }

      toast({
        title: "Success",
        description: "Promotion deleted successfully",
      });

      fetchPromotions();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const isActive = (promotion: Promotion) => {
    const now = new Date();
    const start = new Date(promotion.start_date);
    const end = new Date(promotion.end_date);
    return now >= start && now <= end && promotion.active;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/admin/dashboard">
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </Button>
            <Tag className="w-6 h-6 text-accent" />
            <h1 className="text-xl font-display font-bold">Promotion Management</h1>
          </div>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="w-4 h-4 mr-2" />
            Create Flash Sale
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6 p-4 bg-accent/10 border border-accent/30 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-5 h-5 text-accent" />
            <h3 className="font-display font-bold">Flash Sale Info</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Create promotions with 2x, 3x, or 4x clover multipliers. Customers earn extra clovers
            on all purchases during the promotion period. Promotions apply to all products by default.
          </p>
        </div>

        {/* Promotions Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              Loading promotions...
            </div>
          ) : promotions.length === 0 ? (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              No promotions created yet. Click "Create Flash Sale" to get started!
            </div>
          ) : (
            promotions.map((promotion) => {
              const active = isActive(promotion);
              return (
                <div
                  key={promotion.id}
                  className={`glass-card p-6 relative ${
                    active ? "border-accent/50 bg-accent/5" : ""
                  }`}
                >
                  {active && (
                    <div className="absolute top-3 right-3">
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-accent text-accent-foreground text-xs font-bold animate-pulse">
                        <Zap className="w-3 h-3" />
                        ACTIVE
                      </span>
                    </div>
                  )}

                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-3xl font-display font-bold text-accent">
                        {promotion.multiplier}x
                      </span>
                      <span className="text-sm text-muted-foreground">multiplier</span>
                    </div>
                    <h3 className="font-display font-bold text-lg mb-1">
                      {promotion.name}
                    </h3>
                    {promotion.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {promotion.description}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2 text-sm mb-4">
                    <div>
                      <span className="text-muted-foreground">Start:</span>{" "}
                      <span className="font-medium">{formatDate(promotion.start_date)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">End:</span>{" "}
                      <span className="font-medium">{formatDate(promotion.end_date)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Scope:</span>{" "}
                      <span className="font-medium">All Products</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleOpenDialog(promotion)}
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(promotion.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingPromotion ? "Edit Promotion" : "Create Flash Sale"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Promotion Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Weekend Flash Sale"
                  required
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Earn double clovers on all purchases!"
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="multiplier">Clover Multiplier *</Label>
                <Select
                  value={formData.multiplier}
                  onValueChange={(value) => setFormData({ ...formData, multiplier: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2">2x - Double Clovers</SelectItem>
                    <SelectItem value="3">3x - Triple Clovers</SelectItem>
                    <SelectItem value="4">4x - Quadruple Clovers</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start_date">Start Date & Time *</Label>
                  <Input
                    id="start_date"
                    type="datetime-local"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="end_date">End Date & Time *</Label>
                  <Input
                    id="end_date"
                    type="datetime-local"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <strong>Note:</strong> This promotion will apply to all products in the store.
                  Customers will earn {formData.multiplier}x clovers on every purchase during the promotion period.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {editingPromotion ? "Update Promotion" : "Create Promotion"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPromotions;
