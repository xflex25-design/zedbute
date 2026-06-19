import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface RoyaltyChartProps {
  data: Array<{
    date: string;
    total: number;
    pending: number;
    cleared: number;
  }>;
}

export default function RoyaltyChart({ data }: RoyaltyChartProps) {
  if (!data || data.length === 0) {
    return <p className="text-gray-500 text-center py-8">No data available</p>;
  }

  return (
    <div className="space-y-8">
      {/* Line Chart - Total Earnings Trend */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-4">Total Earnings Trend</h4>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip
              formatter={(value: number) => `$${value.toFixed(2)}`}
              labelFormatter={(label: string) => `Date: ${label}`}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="total"
              stroke="#3b82f6"
              dot={false}
              name="Total Earnings"
              strokeWidth={2}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Bar Chart - Cleared vs Pending */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-4">Cleared vs Pending</h4>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip
              formatter={(value: number) => `$${value.toFixed(2)}`}
              labelFormatter={(label: string) => `Date: ${label}`}
            />
            <Legend />
            <Bar dataKey="cleared" fill="#10b981" name="Cleared" />
            <Bar dataKey="pending" fill="#f59e0b" name="Pending" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}