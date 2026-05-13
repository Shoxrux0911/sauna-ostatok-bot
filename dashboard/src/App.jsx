import React, { useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell 
} from 'recharts';
import { 
  TrendingUp, Users, ShoppingBag, DollarSign, ArrowUpRight, ArrowDownRight, Package, Calendar, Filter, Download
} from 'lucide-react';

const COLORS = ['#38bdf8', '#818cf8', '#fbbf24', '#f87171', '#34d399'];

// Mock ma'lumotlar (Billz API formatida)
const salesData = [
  { date: '01.05', sales: 4500000, profit: 1200000 },
  { date: '02.05', sales: 5200000, profit: 1500000 },
  { date: '03.05', sales: 3800000, profit: 950000 },
  { date: '04.05', sales: 6100000, profit: 1800000 },
  { date: '05.05', sales: 5500000, profit: 1600000 },
  { date: '06.05', sales: 7200000, profit: 2100000 },
  { date: '07.05', sales: 4800000, profit: 1300000 },
];

const categoryData = [
  { name: 'Vagonka', value: 45 },
  { name: 'Polok', value: 25 },
  { name: 'Lipa Taxta', value: 15 },
  { name: 'Olxa Taxta', value: 10 },
  { name: 'Boshqa', value: 5 },
];

const StatCard = ({ title, value, icon: Icon, trend, trendValue }) => (
  <div className="glass-card">
    <div className="flex justify-between items-start mb-4">
      <div className="p-3 bg-sky-500/10 rounded-xl">
        <Icon className="w-6 h-6 text-sky-400" />
      </div>
      {trend && (
        <span className={`flex items-center text-xs font-semibold px-2 py-1 rounded-full ${trend === 'up' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
          {trend === 'up' ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
          {trendValue}%
        </span>
      )}
    </div>
    <div className="stat-label mb-1">{title}</div>
    <div className="stat-value">{value}</div>
  </div>
);

function App() {
  const [timeRange, setTimeRange] = useState('7d');

  return (
    <div className="min-h-screen p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
            Sauna Business Intelligence
          </h1>
          <p className="text-slate-400 mt-1">Sotuvlar va asosiy ko'rsatkichlar tahlili</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm font-medium hover:bg-slate-700 transition-colors">
            <Download className="w-4 h-4" />
            Hisobot yuklash
          </button>
          <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700">
            {['24h', '7d', '30d'].map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${timeRange === range ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20' : 'text-slate-400 hover:text-white'}`}
              >
                {range.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Umumiy tushum" value="37,500,000 UZS" icon={DollarSign} trend="up" trendValue="12.5" />
        <StatCard title="Tranzaksiyalar" value="1,248" icon={ShoppingBag} trend="up" trendValue="8.2" />
        <StatCard title="O'rtacha chek" value="300,480 UZS" icon={TrendingUp} trend="down" trendValue="3.1" />
        <StatCard title="Sof foyda" value="10,850,000 UZS" icon={ArrowUpRight} trend="up" trendValue="15.4" />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Chart */}
        <div className="lg:col-span-2 glass-card flex flex-col">
          <div className="flex justify-between items-center mb-8">
            <h3 className="font-bold text-lg">Sotuvlar grafigi</h3>
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <span className="w-3 h-3 rounded-full bg-sky-500"></span> Tushum
              <span className="w-3 h-3 rounded-full bg-indigo-500 ml-4"></span> Foyda
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesData}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#38bdf8" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#818cf8" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value/1000000}M`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                  itemStyle={{ color: '#f8fafc' }}
                />
                <Area type="monotone" dataKey="sales" stroke="#38bdf8" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
                <Area type="monotone" dataKey="profit" stroke="#818cf8" strokeWidth={3} fillOpacity={1} fill="url(#colorProfit)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="glass-card flex flex-col">
          <h3 className="font-bold text-lg mb-8">Kategoriyalar bo'yicha</h3>
          <div className="h-[250px] w-full flex-grow">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px' }}
                  itemStyle={{ color: '#f8fafc' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-3 mt-4">
            {categoryData.map((item, index) => (
              <div key={item.name} className="flex justify-between items-center text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index] }}></div>
                  <span className="text-slate-400">{item.name}</span>
                </div>
                <span className="font-bold">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Transactions Table */}
      <div className="glass-card overflow-hidden">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-bold text-lg text-white">Oxirgi tranzaksiyalar</h3>
          <button className="text-sky-400 hover:text-sky-300 text-sm font-medium">Barchasini ko'rish</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-slate-400 text-sm uppercase tracking-wider border-b border-slate-700">
                <th className="pb-4 font-medium">ID / Sana</th>
                <th className="pb-4 font-medium">Mijoz / Do'kon</th>
                <th className="pb-4 font-medium">Summa</th>
                <th className="pb-4 font-medium">Holat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {[
                { id: '#TRX-9481', date: '07 May, 15:42', customer: 'Anvar aka', shop: 'Asosiy do\'kon', amount: '2,450,000', status: 'Muvaffaqiyatli' },
                { id: '#TRX-9480', date: '07 May, 14:15', customer: 'Mijoz #21', shop: '2-do\'kon', amount: '850,000', status: 'Muvaffaqiyatli' },
                { id: '#TRX-9479', date: '07 May, 12:05', customer: 'Bekzod', shop: 'Asosiy do\'kon', amount: '12,000,000', status: 'Kutilyapti' },
              ].map((item, i) => (
                <tr key={i} className="hover:bg-slate-700/30 transition-colors group">
                  <td className="py-4">
                    <div className="font-bold text-white group-hover:text-sky-400 transition-colors">{item.id}</div>
                    <div className="text-xs text-slate-500">{item.date}</div>
                  </td>
                  <td className="py-4">
                    <div className="text-slate-300">{item.customer}</div>
                    <div className="text-xs text-slate-500">{item.shop}</div>
                  </td>
                  <td className="py-4 font-bold text-white">
                    {item.amount} <span className="text-xs font-normal text-slate-500">UZS</span>
                  </td>
                  <td className="py-4">
                    <span className={`px-2 py-1 rounded-lg text-xs font-medium ${item.status === 'Muvaffaqiyatli' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default App;
