import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string;
  change: string;
  positive: boolean;
  icon: React.ReactNode;
  color: string;
  bg: string;
  delay?: number;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, change, positive, icon, color, bg, delay = 0 }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 font-medium">{title}</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">{value}</p>
          <div className="flex items-center gap-1 mt-2">
            {positive ? (
              <TrendingUp size={14} className="text-green-500" />
            ) : (
              <TrendingDown size={14} className="text-red-500" />
            )}
            <span className={`text-xs font-semibold ${positive ? 'text-green-600' : 'text-red-500'}`}>
              {change}
            </span>
            <span className="text-xs text-gray-400">vs last month</span>
          </div>
        </div>
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: bg, color }}
        >
          {icon}
        </div>
      </div>
    </motion.div>
  );
};

export default StatCard;
