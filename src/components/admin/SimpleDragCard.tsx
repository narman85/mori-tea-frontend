import React, { useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Edit, EyeOff, Eye, GripVertical, ShoppingCart, TrendingUp } from 'lucide-react';
import { useDrag, useDrop } from 'react-dnd';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  in_stock: boolean;
  stock?: number;
  image: string[];
  created: string;
  updated: string;
  display_order?: number;
  order_count?: number;
  total_sold?: number;
  hidden?: boolean;
  preparation?: {
    amount: string;
    temperature: string;
    steepTime: string;
    taste: string;
  };
}

interface SimpleDragCardProps {
  product: Product;
  index: number;
  onEdit: (product: Product) => void;
  onToggleVisibility: (productId: string) => void;
  moveProduct: (dragIndex: number, hoverIndex: number) => void;
}

const SimpleDragCard: React.FC<SimpleDragCardProps> = ({
  product,
  index,
  onEdit,
  onToggleVisibility,
  moveProduct,
}) => {
  const ref = useRef<HTMLDivElement>(null);

  const [{ handlerId }, drop] = useDrop({
    accept: 'card',
    collect(monitor) {
      return {
        handlerId: monitor.getHandlerId(),
      };
    },
    hover(item: any, monitor) {
      if (!ref.current) {
        return;
      }
      const dragIndex = item.index;
      const hoverIndex = index;

      // Don't replace items with themselves
      if (dragIndex === hoverIndex) {
        return;
      }

      // Determine rectangle on screen
      const hoverBoundingRect = ref.current?.getBoundingClientRect();

      // Get vertical middle
      const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;

      // Determine mouse position
      const clientOffset = monitor.getClientOffset();

      // Get pixels to the top
      const hoverClientY = (clientOffset?.y ?? 0) - hoverBoundingRect.top;

      // Only perform the move when the mouse has crossed half of the items height
      // When dragging downwards, only move when the cursor is below 50%
      // When dragging upwards, only move when the cursor is above 50%

      // Dragging downwards
      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) {
        return;
      }

      // Dragging upwards
      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) {
        return;
      }

      // Time to actually perform the action
      moveProduct(dragIndex, hoverIndex);

      // Note: we're mutating the monitor item here!
      // Generally it's better to avoid mutations,
      // but it's good here for the sake of performance
      // to avoid expensive index searches.
      item.index = hoverIndex;
    },
  });

  const [{ isDragging }, drag] = useDrag({
    type: 'card',
    item: () => {
      return { id: product.id, index };
    },
    collect: (monitor: any) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const opacity = isDragging ? 0.4 : 1;
  drag(drop(ref));

  return (
    <div ref={ref} style={{ opacity }} data-handler-id={handlerId}>
      <Card className={`overflow-hidden hover:shadow-md transition-shadow ${
        product.stock !== undefined 
          ? (product.stock <= 0 ? 'border-orange-200 bg-orange-50' : '')
          : !product.in_stock 
            ? 'opacity-60 border-red-200 bg-red-50' 
            : ''
      }`}>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div className="flex items-start gap-2 flex-1">
              <div className="flex items-center justify-center p-1 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing">
                <GripVertical className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-lg">
                  {product.name}
                </CardTitle>
              </div>
            </div>
            <div className="flex gap-1 ml-2">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => onEdit(product)}
                title="Edit product"
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => onToggleVisibility(product.id)}
                className={product.hidden ? "text-green-600 hover:text-green-700" : "text-orange-600 hover:text-orange-700"}
                title={product.hidden ? "Show product to customers" : "Hide product from customers"}
              >
                {product.hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-2xl font-bold text-green-600">
                €{product.price.toFixed(2)}
              </span>
              <div className="flex flex-col gap-1 items-end">
                {product.stock !== undefined && product.stock <= 0 && (
                  <span className="text-xs font-medium px-2 py-1 rounded bg-red-100 text-red-700">
                    Out of Stock
                  </span>
                )}
                {product.stock !== undefined && product.stock > 0 && product.stock < 10 && (
                  <span className="text-xs font-medium px-2 py-1 rounded bg-orange-100 text-orange-700">
                    Stock: {product.stock}
                  </span>
                )}
                {product.stock !== undefined && product.stock >= 10 && (
                  <span className="text-xs font-medium px-2 py-1 rounded bg-green-100 text-green-700">
                    Stock: {product.stock}
                  </span>
                )}
                {product.order_count !== undefined && (
                  <span className="text-xs font-medium px-2 py-1 rounded bg-blue-100 text-blue-700 flex items-center gap-1">
                    <ShoppingCart className="h-3 w-3" />
                    Orders: {product.order_count}
                  </span>
                )}
                {product.total_sold !== undefined && product.total_sold > 0 && (
                  <span className="text-xs font-medium px-2 py-1 rounded bg-purple-100 text-purple-700 flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    Sold: {product.total_sold}
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SimpleDragCard;