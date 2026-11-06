import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, ArrowRight, Loader2, ShieldCheck, User } from 'lucide-react';
import { useAuth, DEMO_ACCOUNTS } from '../../contexts/AuthContext';
import { showToast } from '../../components/ui/Toast';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});
type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const { signIn, loginAsDemo } = useAuth();
  const navigate = useNavigate();
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: 'admin@roomiesplit.com',
      password: 'admin123',
    },
  });

  const onSubmit = async (data: FormData) => {
    setSubmitting(true);
    try {
      await signIn(data.email, data.password);
      showToast('Signed in successfully!', 'success');
      navigate('/');
    } catch (err: any) {
      showToast(err.message || 'Login failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePickAccount = async (acc: typeof DEMO_ACCOUNTS[0]) => {
    setValue('email', acc.email);
    setValue('password', acc.role.includes('Leader') ? 'admin123' : `${acc.name.split(' ')[0].toLowerCase()}123`);
    setSubmitting(true);
    try {
      await loginAsDemo(acc.userId, acc.name, acc.email);
      showToast(`Signed in as ${acc.name}!`, 'success');
      navigate('/');
    } catch (err: any) {
      showToast(err.message || 'Demo login failed', 'error');
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
        style={{ maxWidth: 460 }}
      >
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div
            style={{
              width: 56, height: 56, borderRadius: 16, background: '#FFE66D',
              border: '2px solid #292524', boxShadow: '4px 4px 0 #292524',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.8rem', marginBottom: 10,
            }}
          >
            🏠
          </div>
          <h1 className="heading-xl">RoomieSplit</h1>
          <p style={{ color: '#6B625B', fontSize: '0.9rem', marginTop: 4 }}>
            Shared household expense & budget management
          </p>
        </div>

        {/* Demo Accounts Quick-Select */}
        <div
          style={{
            background: '#FFF9D2',
            border: '2px solid #292524',
            boxShadow: '3px 3px 0 #292524',
            borderRadius: 14,
            padding: 16,
            marginBottom: 18,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              ⚡ 1-Click Test Accounts
            </span>
            <span className="badge badge-warning !text-[0.65rem] !py-0.5">Seeded Data Ready</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {DEMO_ACCOUNTS.map(acc => {
              const isLeader = acc.role.includes('Leader');
              return (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => handlePickAccount(acc)}
                  disabled={submitting}
                  style={{
                    background: isLeader ? '#FFE66D' : '#FFFFFF',
                    border: '1.5px solid #292524',
                    borderRadius: 10,
                    padding: '8px 10px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    boxShadow: '2px 2px 0 #292524',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                  }}
                  className="hover:-translate-y-0.5 transition-transform"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {isLeader ? <ShieldCheck size={13} /> : <User size={13} />}
                    <span style={{ fontWeight: 800, fontSize: '0.78rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {acc.name.split(' ')[0]} {isLeader ? '(Leader)' : ''}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.65rem', color: '#57534E' }}>{acc.email}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Card */}
        <div className="nb-card bg-white" style={{ padding: '24px 28px' }}>
          <h2 className="heading-md" style={{ marginBottom: 4 }}>Sign In</h2>
          <p style={{ color: '#6B625B', fontSize: '0.875rem', marginBottom: 18 }}>
            Enter your credentials or choose a test account above
          </p>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            {/* Email */}
            <div>
              <label htmlFor="login-email" className="form-label">Email Address</label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9E9087' }} />
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  className="form-input"
                  style={{ paddingLeft: 36 }}
                  placeholder="admin@roomiesplit.com"
                  {...register('email')}
                />
              </div>
              {errors.email && <p className="form-error">{errors.email.message}</p>}
            </div>

            {/* Password */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <label htmlFor="login-password" className="form-label" style={{ margin: 0 }}>Password</label>
                <Link
                  to="/auth/forgot-password"
                  style={{ fontSize: '0.78rem', color: '#6B625B', fontWeight: 600, textDecoration: 'underline' }}
                >
                  Forgot?
                </Link>
              </div>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9E9087' }} />
                <input
                  id="login-password"
                  type={showPass ? 'text' : 'password'}
                  autoComplete="current-password"
                  className="form-input"
                  style={{ paddingLeft: 36, paddingRight: 40 }}
                  placeholder="••••••••"
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9E9087' }}
                  aria-label={showPass ? 'Hide password' : 'Show password'}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p className="form-error">{errors.password.message}</p>}
            </div>

            <button
              type="submit"
              id="login-submit"
              disabled={submitting}
              className="btn btn-primary btn-lg w-full justify-center"
            >
              {submitting ? <Loader2 size={18} className="animate-spin" /> : null}
              {submitting ? 'Signing in…' : 'Sign In as Leader / Roommate'}
              {!submitting && <ArrowRight size={16} />}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: 18, fontSize: '0.88rem', color: '#6B625B' }}>
          Don't have an account?{' '}
          <Link to="/auth/signup" style={{ fontWeight: 700, color: '#292524', textDecoration: 'underline' }}>
            Sign up
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
