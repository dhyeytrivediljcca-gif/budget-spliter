import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, User, ArrowRight, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { profileApi } from '../../api';
import { showToast } from '../../components/ui/Toast';

const schema = z.object({
  displayName: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
}).refine(d => d.password === d.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});
type FormData = z.infer<typeof schema>;

export default function SignupPage() {
  const { signUp, signIn, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setSubmitting(true);
    try {
      await signUp(data.email, data.password, data.displayName);
      try {
        await profileApi.create({ display_name: data.displayName });
        await refreshProfile();
      } catch {
        // profile might already be created
      }
      showToast('Welcome to RoomieSplit! 🎉', 'success');
      navigate('/onboarding');
    } catch (err: any) {
      showToast(err.message || 'Sign up failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-dvh flex items-center justify-center p-4" style={{ background: '#FFFDF7' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full"
        style={{ maxWidth: 420 }}
      >
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{ background: '#FFE66D', border: '2px solid #292524', boxShadow: '4px 4px 0 #292524' }}
          >
            <span style={{ fontSize: '2rem' }}>🏠</span>
          </div>
          <h1 className="heading-lg">Join RoomieSplit</h1>
          <p style={{ color: '#6B625B', marginTop: 6, fontSize: '0.9rem' }}>
            Split expenses fairly with your roommates
          </p>
        </div>

        <div className="nb-card" style={{ padding: 28 }}>
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="mb-4">
              <label htmlFor="signup-name" className="form-label">Display Name</label>
              <div style={{ position: 'relative' }}>
                <User size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9E9087' }} />
                <input
                  id="signup-name"
                  type="text"
                  autoComplete="name"
                  className="form-input"
                  style={{ paddingLeft: 36 }}
                  placeholder="Dhyey Patel"
                  {...register('displayName')}
                />
              </div>
              {errors.displayName && <p className="form-error">{errors.displayName.message}</p>}
            </div>

            <div className="mb-4">
              <label htmlFor="signup-email" className="form-label">Email</label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9E9087' }} />
                <input
                  id="signup-email"
                  type="email"
                  autoComplete="email"
                  className="form-input"
                  style={{ paddingLeft: 36 }}
                  placeholder="you@example.com"
                  {...register('email')}
                />
              </div>
              {errors.email && <p className="form-error">{errors.email.message}</p>}
            </div>

            <div className="mb-4">
              <label htmlFor="signup-password" className="form-label">Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9E9087' }} />
                <input
                  id="signup-password"
                  type={showPass ? 'text' : 'password'}
                  autoComplete="new-password"
                  className="form-input"
                  style={{ paddingLeft: 36, paddingRight: 40 }}
                  placeholder="Min. 6 characters"
                  {...register('password')}
                />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9E9087' }}
                  aria-label="Toggle password visibility"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p className="form-error">{errors.password.message}</p>}
            </div>

            <div className="mb-6">
              <label htmlFor="signup-confirm" className="form-label">Confirm Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9E9087' }} />
                <input
                  id="signup-confirm"
                  type={showPass ? 'text' : 'password'}
                  autoComplete="new-password"
                  className="form-input"
                  style={{ paddingLeft: 36 }}
                  placeholder="Repeat password"
                  {...register('confirmPassword')}
                />
              </div>
              {errors.confirmPassword && <p className="form-error">{errors.confirmPassword.message}</p>}
            </div>

            <button type="submit" id="signup-submit" disabled={submitting} className="btn btn-primary btn-lg w-full justify-center">
              {submitting ? <Loader2 size={18} className="animate-spin" /> : null}
              {submitting ? 'Creating account…' : 'Create Account'}
              {!submitting && <ArrowRight size={16} />}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: '0.9rem', color: '#6B625B' }}>
          Already have an account?{' '}
          <Link to="/auth/login" style={{ fontWeight: 700, color: '#292524', textDecoration: 'underline' }}>
            Sign in
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
