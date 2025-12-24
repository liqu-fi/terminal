import { 
  BarChart2, BarChart3, Briefcase, Search, Activity, AlertTriangle, X, Check, Info,
  ChevronLeft, ChevronRight, Pause, Zap, Star, Pencil, ArrowUpDown, ArrowUp, ArrowDown,
  Settings, Bell, Globe, Wifi, WifiOff, RefreshCw, Plus, Minus, LineChart,
  Wallet, ClipboardList, ArrowLeftRight, Star as StarOutline,
  TrendingUp, TrendingDown, AlertCircle, BookOpen,
  // Wallet page icons
  Download, Upload, Copy, Link, History, Building2, CheckCircle, Loader, Trash2,
  CreditCard, ExternalLink, ChevronDown, ChevronUp, Filter, Clock,
  Sun, Moon, List, Inbox, Archive, Play,
  // Chart icons
  Maximize2, Minimize2, Target, Crosshair, Shield,
  // View toggle icons
  LayoutGrid, LayoutList, Grid,
  // Orders page icons
  Layers, Percent, Repeat, PieChart, Send, Radio, XCircle, Eye, EyeOff, Scroll, Banknote, Layout,
  // Settings page icons
  User, Lock, Key, Smartphone, Monitor, Volume2, VolumeX, BellRing, BellOff,
  Languages, Palette, Database, FileText, LogOut, HardDrive, Server, Fingerprint,
  ShieldCheck, ShieldAlert, UserCheck, Mail, MessageSquare, ToggleLeft, ToggleRight,
  Sliders, Timer, Gauge, Binary, QrCode, Scan, KeyRound, UserCog, BellPlus,
  MonitorSmartphone, CloudOff, Cloud, Cpu, MemoryStick, CircleDot, Eraser,
  // Extra mobile icons
  Users, Gift, Headphones, HelpCircle,
  Camera, Circle, DollarSign, Pencil as Edit,
  // Advanced order icons
  GitBranch, Split
} from 'lucide-react';
import { CSSProperties } from 'react';

export type IconName =
  | 'bar-chart-2'
  | 'bar-chart-3'
  | 'briefcase'
  | 'search'
  | 'activity'
  | 'alert-triangle'
  | 'alert-circle'
  | 'x'
  | 'check'
  | 'info'
  | 'chevron-left'
  | 'chevron-right'
  | 'chevron-down'
  | 'chevron-up'
  | 'pause'
  | 'zap'
  | 'star'
  | 'star-filled'
  | 'pencil'
  | 'arrow-up-down'
  | 'arrow-up'
  | 'arrow-down'
  | 'trending-up'
  | 'trending-down'
  | 'settings'
  | 'bell'
  | 'globe'
  | 'wifi'
  | 'wifi-off'
  | 'refresh-cw'
  | 'plus'
  | 'minus'
  | 'line-chart'
  | 'wallet'
  | 'clipboard-list'
  | 'arrow-left-right'
  // Wallet page icons
  | 'download'
  | 'upload'
  | 'copy'
  | 'link'
  | 'history'
  | 'building-2'
  | 'check-circle'
  | 'loader'
  | 'trash-2'
  | 'credit-card'
  | 'external-link'
  | 'filter'
  | 'clock'
  | 'sun'
  | 'moon'
  | 'list'
  | 'book-open'
  | 'inbox'
  | 'archive'
  | 'play'
  | 'maximize-2'
  | 'minimize-2'
  | 'target'
  | 'shield'
  | 'crosshair'
  | 'layout-grid'
  | 'layout-list'
  | 'grid'
  // Orders page icons
  | 'layers'
  | 'percent'
  | 'repeat'
  | 'pie-chart'
  | 'send'
  | 'radio'
  | 'x-circle'
  | 'eye'
  | 'eye-off'
  | 'scroll'
  | 'banknote'
  | 'layout'
  | 'camera'
  | 'circle'
  | 'dollar-sign'
  | 'edit'
  // Settings page icons
  | 'user'
  | 'lock'
  | 'key'
  | 'smartphone'
  | 'monitor'
  | 'volume-2'
  | 'volume-x'
  | 'bell-ring'
  | 'bell-off'
  | 'languages'
  | 'palette'
  | 'database'
  | 'file-text'
  | 'log-out'
  | 'hard-drive'
  | 'server'
  | 'fingerprint'
  | 'shield-check'
  | 'shield-alert'
  | 'user-check'
  | 'mail'
  | 'message-square'
  | 'toggle-left'
  | 'toggle-right'
  | 'sliders'
  | 'timer'
  | 'gauge'
  | 'binary'
  | 'qr-code'
  | 'scan'
  | 'key-round'
  | 'user-cog'
  | 'bell-plus'
  | 'monitor-smartphone'
  | 'cloud-off'
  | 'cloud'
  | 'cpu'
  | 'memory-stick'
  | 'circle-dot'
  | 'eraser'
  | 'users'
  | 'gift'
  | 'headphones'
  | 'help-circle'
  | 'git-branch'
  | 'split';

const iconMap: Record<IconName, typeof BarChart3> = {
  'bar-chart-2': BarChart2,
  'bar-chart-3': BarChart3,
  'briefcase': Briefcase,
  'search': Search,
  'activity': Activity,
  'alert-triangle': AlertTriangle,
  'alert-circle': AlertCircle,
  'x': X,
  'check': Check,
  'info': Info,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  'chevron-down': ChevronDown,
  'chevron-up': ChevronUp,
  'pause': Pause,
  'zap': Zap,
  'star': StarOutline,
  'star-filled': Star,
  'pencil': Pencil,
  'arrow-up-down': ArrowUpDown,
  'arrow-up': ArrowUp,
  'arrow-down': ArrowDown,
  'trending-up': TrendingUp,
  'trending-down': TrendingDown,
  'settings': Settings,
  'bell': Bell,
  'globe': Globe,
  'wifi': Wifi,
  'wifi-off': WifiOff,
  'refresh-cw': RefreshCw,
  'plus': Plus,
  'minus': Minus,
  'line-chart': LineChart,
  'wallet': Wallet,
  'clipboard-list': ClipboardList,
  'arrow-left-right': ArrowLeftRight,
  // Wallet page icons
  'download': Download,
  'upload': Upload,
  'copy': Copy,
  'link': Link,
  'history': History,
  'building-2': Building2,
  'check-circle': CheckCircle,
  'loader': Loader,
  'trash-2': Trash2,
  'credit-card': CreditCard,
  'external-link': ExternalLink,
  'filter': Filter,
  'clock': Clock,
  'sun': Sun,
  'moon': Moon,
  'list': List,
  'book-open': BookOpen,
  'inbox': Inbox,
  'archive': Archive,
  'play': Play,
  'maximize-2': Maximize2,
  'minimize-2': Minimize2,
  'target': Target,
  'shield': Shield,
  'crosshair': Crosshair,
  'layout-grid': LayoutGrid,
  'layout-list': LayoutList,
  'grid': Grid,
  // Orders page icons
  'layers': Layers,
  'percent': Percent,
  'repeat': Repeat,
  'pie-chart': PieChart,
  'send': Send,
  'radio': Radio,
  'x-circle': XCircle,
  'eye': Eye,
  'eye-off': EyeOff,
  'scroll': Scroll,
  'banknote': Banknote,
  'layout': Layout,
  'camera': Camera,
  'circle': Circle,
  'dollar-sign': DollarSign,
  'edit': Edit,
  // Settings page icons
  'user': User,
  'lock': Lock,
  'key': Key,
  'smartphone': Smartphone,
  'monitor': Monitor,
  'volume-2': Volume2,
  'volume-x': VolumeX,
  'bell-ring': BellRing,
  'bell-off': BellOff,
  'languages': Languages,
  'palette': Palette,
  'database': Database,
  'file-text': FileText,
  'log-out': LogOut,
  'hard-drive': HardDrive,
  'server': Server,
  'fingerprint': Fingerprint,
  'shield-check': ShieldCheck,
  'shield-alert': ShieldAlert,
  'user-check': UserCheck,
  'mail': Mail,
  'message-square': MessageSquare,
  'toggle-left': ToggleLeft,
  'toggle-right': ToggleRight,
  'sliders': Sliders,
  'timer': Timer,
  'gauge': Gauge,
  'binary': Binary,
  'qr-code': QrCode,
  'scan': Scan,
  'key-round': KeyRound,
  'user-cog': UserCog,
  'bell-plus': BellPlus,
  'monitor-smartphone': MonitorSmartphone,
  'cloud-off': CloudOff,
  'cloud': Cloud,
  'cpu': Cpu,
  'memory-stick': MemoryStick,
  'circle-dot': CircleDot,
  'eraser': Eraser,
  'users': Users,
  'gift': Gift,
  'headphones': Headphones,
  'help-circle': HelpCircle,
  'git-branch': GitBranch,
  'split': Split,
};

export type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const sizeMap: Record<IconSize, number> = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 24,
};

export interface IconProps {
  name: IconName;
  size?: IconSize;
  className?: string;
  style?: CSSProperties;
  strokeWidth?: number;
}

export function Icon({ 
  name, 
  size = 'md', 
  className = '', 
  style,
  strokeWidth = 1.5 
}: IconProps) {
  const IconComponent = iconMap[name];
  
  if (!IconComponent) {
    console.warn(`Icon "${name}" not found`);
    return null;
  }

  const iconSize = sizeMap[size];

  return (
    <IconComponent
      size={iconSize}
      strokeWidth={strokeWidth}
      className={className}
      style={style}
    />
  );
}





