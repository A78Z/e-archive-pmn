'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserPlus, Shield, Eye, EyeOff } from 'lucide-react';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

const FUNCTIONS = [
  'Coordonnateur du Projet Mobilier National',
  'Coordonnateur adjoint du Projet Mobilier National',
  'Responsable Administratif et Financier',
  'Comptable',
  'Comptable des matières',
  'Ressources humaines',
  'Pôle programmes et projets',
  'Pôle Passation des marchés',
  'Responsable Courriers',
  'Assistante',
  "Agent d'archive",
  'Développeur web',
];

const ROLES = [
  { value: 'super_admin', label: 'Super Administrateur' },
  { value: 'admin', label: 'Administrateur' },
  { value: 'user', label: 'Agent Standard' },
  { value: 'guest', label: 'Agent Invité' },
];

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [fonction, setFonction] = useState('');
  const [role, setRole] = useState('user');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{
    fullName?: string;
    email?: string;
    fonction?: string;
    password?: string;
    confirmPassword?: string;
  }>({});

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@pmn\.sn$/i;
    return emailRegex.test(email);
  };

  const validateForm = () => {
    const newErrors: any = {};

    if (!fullName || fullName.trim().length < 2) {
      newErrors.fullName = "Nom d'utilisateur requis (min. 2 caractères)";
    }

    if (!email) {
      newErrors.email = 'Email requis';
    } else if (!validateEmail(email)) {
      newErrors.email = 'Email doit être au format @pmn.sn';
    }

    if (!fonction) {
      newErrors.fonction = 'Veuillez sélectionner une fonction';
    }

    if (!password) {
      newErrors.password = 'Mot de passe requis';
    } else if (password.length < 6) {
      newErrors.password = 'Mot de passe trop court (min. 6 caractères)';
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = 'Confirmation requise';
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Les mots de passe ne correspondent pas';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const normalizedEmail = email.toLowerCase().trim();

      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .ilike('email', normalizedEmail)
        .maybeSingle();

      if (existingUser) {
        toast.error('Cet utilisateur existe déjà. Essayez de vous connecter ou utilisez un autre email.');
        setLoading(false);
        return;
      }

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: undefined,
          data: {
            full_name: fullName,
            role: role,
            fonction: fonction,
          },
        },
      });

      if (authError) {
        if (authError.message.includes('already registered') || authError.message.includes('User already registered')) {
          toast.error('Cet utilisateur existe déjà. Essayez de vous connecter ou utilisez un autre email.');
        } else {
          toast.error('Erreur lors de la création du compte. Veuillez vérifier vos informations.');
        }
        setLoading(false);
        return;
      }

      if (authData.user) {
        const { error: profileError } = await supabase.from('users').upsert({
          id: authData.user.id,
          email: normalizedEmail,
          full_name: fullName,
          role: role,
          fonction: fonction,
          is_verified: false,
          avatar_url: null,
        });

        if (profileError) {
          console.error('Profile error:', profileError);
        }

        toast.success('✅ Compte créé avec succès. En attente de validation par le Super Administrateur.', {
          duration: 4000,
        });

        setTimeout(() => {
          router.push('/login');
        }, 4000);
      }
    } catch (error: any) {
      console.error('Registration error:', error);
      toast.error('Erreur lors de la création du compte. Veuillez vérifier vos informations.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 py-12">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <Image
              src="/logo-navbare.png"
              alt="Logo Projet Mobilier National"
              width={120}
              height={120}
              priority
              className="drop-shadow-lg"
            />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Créer un compte</h1>
          <p className="text-gray-600 text-sm">Nouveau compte agent PMN</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <form onSubmit={handleRegister} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-sm font-medium text-gray-700">
                Nom d'utilisateur
              </Label>
              <Input
                id="fullName"
                type="text"
                placeholder="MOUSSA SYLLA"
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  setErrors({ ...errors, fullName: undefined });
                }}
                className={`h-12 ${errors.fullName ? 'border-red-500 focus:ring-red-500' : ''}`}
              />
              {errors.fullName && (
                <p className="text-red-500 text-sm mt-1">{errors.fullName}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="ali@pmn.sn"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setErrors({ ...errors, email: undefined });
                }}
                className={`h-12 ${errors.email ? 'border-red-500 focus:ring-red-500' : ''}`}
              />
              {errors.email && (
                <p className="text-red-500 text-sm mt-1">{errors.email}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="fonction" className="text-sm font-medium text-gray-700">
                Fonction
              </Label>
              <Select value={fonction} onValueChange={(value) => {
                setFonction(value);
                setErrors({ ...errors, fonction: undefined });
              }}>
                <SelectTrigger className={`h-12 ${errors.fonction ? 'border-red-500' : ''}`}>
                  <SelectValue placeholder="Sélectionner une fonction" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {FUNCTIONS.map((func) => (
                    <SelectItem key={func} value={func} className="py-2">
                      {func}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.fonction && (
                <p className="text-red-500 text-sm mt-1">{errors.fonction}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="role" className="text-sm font-medium text-gray-700">
                Rôle
              </Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value} className="py-2">
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                Mot de passe
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="•••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setErrors({ ...errors, password: undefined });
                  }}
                  className={`h-12 pr-20 ${errors.password ? 'border-red-500 focus:ring-red-500' : ''}`}
                />
                <div className="absolute right-3 top-3.5 flex items-center gap-2">
                  <Shield className="h-5 w-5 text-gray-400" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>
              {errors.password && (
                <p className="text-red-500 text-sm mt-1">{errors.password}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700">
                Confirmer le mot de passe
              </Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setErrors({ ...errors, confirmPassword: undefined });
                  }}
                  className={`h-12 pr-10 ${errors.confirmPassword ? 'border-red-500 focus:ring-red-500' : ''}`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-red-500 text-sm mt-1">{errors.confirmPassword}</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full h-12 bg-pmn-green hover:bg-pmn-yellow hover:text-pmn-green text-white font-medium text-base rounded-xl shadow-lg transition-all"
              disabled={loading}
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  <span>Création...</span>
                </div>
              ) : (
                'Créer le compte'
              )}
            </Button>

            <div className="text-center pt-2">
              <Link
                href="/login"
                className="text-sm text-pmn-green hover:text-pmn-yellow font-medium transition-colors"
              >
                Retour à la connexion
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
