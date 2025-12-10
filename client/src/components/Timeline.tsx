'use client';

import { ReactNode } from 'react';

export type TimelineItemStatus = 'completed' | 'current' | 'pending';

export interface TimelineItemData {
  id: number;
  label: string;
  description?: string;
  icon: ReactNode;
  status: TimelineItemStatus;
  color: string;
  timestamp?: string;
  actor?: {
    name: string;
    address?: string;
    location?: string;
  };
  metadata?: Record<string, string>;
}

interface TimelineProps {
  items: TimelineItemData[];
  className?: string;
}

interface TimelineItemProps {
  item: TimelineItemData;
  isLast: boolean;
}

function TimelineItem({ item, isLast }: TimelineItemProps) {
  const { status, label, description, icon, color, timestamp, actor, metadata } = item;

  const isCompleted = status === 'completed';
  const isCurrent = status === 'current';
  const isPending = status === 'pending';

  // Status-based styles
  const getIconBgClass = () => {
    if (isCompleted) return `${color} shadow-lg`;
    if (isCurrent) return `${color} shadow-lg ring-4 ring-offset-2 ring-offset-[#12121a]`;
    return 'bg-gray-800';
  };

  const getRingClass = () => {
    if (isCurrent) {
      // Extract color for ring (e.g., bg-blue-500 -> ring-blue-500/30)
      const ringColor = color.replace('bg-', 'ring-').replace('500', '500/30');
      return ringColor;
    }
    return '';
  };

  const getLineClass = () => {
    if (isCompleted) return 'bg-gradient-to-b from-green-500 to-green-500/50';
    if (isCurrent) return 'bg-gradient-to-b from-blue-500/50 to-gray-800';
    return 'bg-gray-800';
  };

  return (
    <div className="flex gap-4 group">
      {/* Timeline Line & Icon */}
      <div className="flex flex-col items-center">
        {/* Icon Circle */}
        <div 
          className={`
            relative w-12 h-12 rounded-full flex items-center justify-center text-white
            transition-all duration-300
            ${getIconBgClass()}
            ${getRingClass()}
            ${isCurrent ? 'animate-pulse' : ''}
          `}
        >
          {isCompleted && (
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center shadow-lg">
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
          {icon}
        </div>
        
        {/* Connecting Line */}
        {!isLast && (
          <div className={`w-0.5 flex-1 min-h-[60px] ${getLineClass()} transition-colors duration-300`} />
        )}
      </div>

      {/* Content */}
      <div className={`flex-1 pb-8 ${isPending ? 'opacity-40' : ''}`}>
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <h4 className={`font-semibold ${isPending ? 'text-gray-500' : 'text-white'}`}>
            {label}
          </h4>
          {isCurrent && (
            <span className="px-2.5 py-1 bg-blue-500/20 text-blue-400 text-xs font-medium rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
              In Progress
            </span>
          )}
          {isCompleted && (
            <span className="px-2.5 py-1 bg-green-500/20 text-green-400 text-xs font-medium rounded-full">
              Completed
            </span>
          )}
        </div>

        {/* Description */}
        {description && (
          <p className={`text-sm mb-3 ${isPending ? 'text-gray-600' : 'text-gray-400'}`}>
            {description}
          </p>
        )}

        {/* Completed/Current Stage Card */}
        {(isCompleted || isCurrent) && (actor || timestamp || metadata) && (
          <div className={`
            p-4 rounded-xl border transition-all duration-300
            ${isCompleted 
              ? 'bg-green-500/5 border-green-500/20 hover:border-green-500/40' 
              : 'bg-blue-500/5 border-blue-500/20 hover:border-blue-500/40'}
          `}>
            {/* Actor Info */}
            {actor && (
              <div className="mb-3">
                <div className="flex items-center gap-2 mb-1">
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span className="text-sm font-medium text-white">{actor.name}</span>
                </div>
                {actor.location && (
                  <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {actor.location}
                  </div>
                )}
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  <span className="font-mono truncate">{actor.address}</span>
                </div>
              </div>
            )}

            {/* Timestamp */}
            {timestamp && (
              <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {timestamp}
              </div>
            )}

            {/* Additional Metadata */}
            {metadata && Object.keys(metadata).length > 0 && (
              <div className="pt-3 border-t border-gray-800/50 space-y-1.5">
                {Object.entries(metadata).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between text-xs">
                    <span className="text-gray-500 capitalize">{key.replace(/_/g, ' ')}</span>
                    <span className="text-gray-300 font-medium">{value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Pending Stage Placeholder */}
        {isPending && (
          <div className="p-4 rounded-xl border border-dashed border-gray-800 bg-gray-900/30">
            <p className="text-xs text-gray-600 text-center">Awaiting previous stages</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function Timeline({ items, className = '' }: TimelineProps) {
  return (
    <div className={`${className}`}>
      {items.map((item, index) => (
        <TimelineItem
          key={item.id}
          item={item}
          isLast={index === items.length - 1}
        />
      ))}
    </div>
  );
}

export default Timeline;
