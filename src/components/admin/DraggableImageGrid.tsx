import React, { useRef } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { X, GripVertical } from 'lucide-react';

interface DraggableImageProps {
  file: File;
  index: number;
  onMove: (dragIndex: number, hoverIndex: number) => void;
  onRemove: (index: number) => void;
  label: string;
  labelColor: string;
}

const DraggableImage: React.FC<DraggableImageProps> = ({
  file,
  index,
  onMove,
  onRemove,
  label,
  labelColor
}) => {
  const ref = useRef<HTMLDivElement>(null);

  const [{ handlerId }, drop] = useDrop({
    accept: 'image',
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

      if (dragIndex === hoverIndex) {
        return;
      }

      const hoverBoundingRect = ref.current?.getBoundingClientRect();
      const hoverMiddleX = (hoverBoundingRect.right - hoverBoundingRect.left) / 2;
      const clientOffset = monitor.getClientOffset();
      const hoverClientX = (clientOffset?.x ?? 0) - hoverBoundingRect.left;

      if (dragIndex < hoverIndex && hoverClientX < hoverMiddleX) {
        return;
      }

      if (dragIndex > hoverIndex && hoverClientX > hoverMiddleX) {
        return;
      }

      onMove(dragIndex, hoverIndex);
      item.index = hoverIndex;
    },
  });

  const [{ isDragging }, drag, preview] = useDrag({
    type: 'image',
    item: () => {
      return { id: file.name, index };
    },
    collect: (monitor: any) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const opacity = isDragging ? 0.4 : 1;
  
  // Connect drag and drop
  drag(drop(ref));

  return (
    <div ref={ref} style={{ opacity }} data-handler-id={handlerId}>
      <div className="relative group">
        <img
          src={URL.createObjectURL(file)}
          alt={label}
          className="w-full h-24 object-cover rounded-lg border"
        />
        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-opacity rounded-lg flex items-center justify-center">
          <GripVertical className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-move" />
        </div>
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 hover:bg-red-600 transition-colors"
        >
          <X className="h-3 w-3" />
        </button>
        <div className={`absolute bottom-1 left-1 ${labelColor} text-white text-xs px-1 py-0.5 rounded`}>
          {label}
        </div>
      </div>
    </div>
  );
};

interface DraggableImageGridProps {
  images: File[];
  onReorder: (newOrder: File[]) => void;
  onRemove: (index: number) => void;
  labelPrefix: string;
  labelColor: string;
}

const DraggableImageGrid: React.FC<DraggableImageGridProps> = ({
  images,
  onReorder,
  onRemove,
  labelPrefix,
  labelColor
}) => {
  const moveImage = (dragIndex: number, hoverIndex: number) => {
    const draggedImage = images[dragIndex];
    const newImages = [...images];
    newImages.splice(dragIndex, 1);
    newImages.splice(hoverIndex, 0, draggedImage);
    onReorder(newImages);
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      {images.map((file, index) => (
        <DraggableImage
          key={file.name + index}
          file={file}
          index={index}
          onMove={moveImage}
          onRemove={onRemove}
          label={`${labelPrefix} ${index + 1}`}
          labelColor={labelColor}
        />
      ))}
    </div>
  );
};

export default DraggableImageGrid;