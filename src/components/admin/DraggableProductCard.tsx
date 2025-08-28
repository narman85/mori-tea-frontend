import React, { useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Edit, Trash2, GripVertical } from 'lucide-react';
import { useDrag, useDrop } from 'react-dnd';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  in_stock: boolean;
  image: string[];
  created: string;
  updated: string;
  display_order?: number;
  preparation?: {
    amount: string;
    temperature: string;
    steepTime: string;
    taste: string;
  };
}

interface DraggableProductCardProps {
  product: Product;
  index: number;
  onEdit: (product: Product) => void;
  onDelete: (productId: string) => void;
  onMove: (dragIndex: number, hoverIndex: number) => void;
  onDragEnd?: () => void;
}

const DraggableProductCard: React.FC<DraggableProductCardProps> = ({
  product,
  index,
  onEdit,
  onDelete,
  onMove,
  onDragEnd,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  
  const [{ isDragging }, drag] = useDrag({
    type: 'product',
    item: { index, id: product.id },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
    end: () => {
      // Call onDragEnd when drag operation finishes
      if (onDragEnd) {
        onDragEnd();
      }
    },
  });

  const [, drop] = useDrop({
    accept: 'product',
    hover: (item: { index: number; id: string }, monitor) => {
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
      onMove(dragIndex, hoverIndex);

      // Note: we're mutating the monitor item here!
      // Generally it's better to avoid mutations,
      // but it's good here for the sake of performance
      // to avoid expensive index searches.
      item.index = hoverIndex;
    },
  });

  // Connect drag and drop to the same element
  drag(drop(ref));

  return (
    <div ref={ref} style={{ opacity: isDragging ? 0.5 : 1 }}>
      <Card className="overflow-hidden cursor-move hover:shadow-md transition-shadow">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div className="flex items-start gap-2 flex-1">
              <div className="flex items-center justify-center p-1 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing">
                <GripVertical className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-lg">{product.name}</CardTitle>
                <CardDescription className="line-clamp-2">
                  {product.description || 'No description'}
                </CardDescription>
              </div>
            </div>
            <div className="flex gap-1 ml-2">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => onEdit(product)}
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => onDelete(product.id)}
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
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
              <Badge 
                variant={product.in_stock ? "default" : "destructive"}
              >
                {product.in_stock ? "In Stock" : "Out of Stock"}
              </Badge>
            </div>
            {product.category && (
              <p className="text-sm text-gray-600">
                Category: {product.category}
              </p>
            )}
            <div className="flex justify-between items-center">
              <p className="text-xs text-gray-500">
                Created: {new Date(product.created).toLocaleDateString()}
              </p>
              {product.display_order && (
                <p className="text-xs text-blue-600 font-medium">
                  Order: {product.display_order}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DraggableProductCard;