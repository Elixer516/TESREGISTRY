import { Navigate, Route, Routes } from 'react-router-dom';
import { RequireRole } from './components/RequireRole';
import { RootLayout } from './layouts/RootLayout';
import { TraineeLayout } from './layouts/TraineeLayout';
import { LoginPage } from './pages/auth/LoginPage';
import { ApplyPage } from './pages/apply/ApplyPage';
import { ApplyStatusPage } from './pages/apply/ApplyStatusPage';
import { DashboardPage } from './pages/DashboardPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { UnauthorizedPage } from './pages/UnauthorizedPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { StudentsPage } from './pages/students/StudentsPage';
import { EnrollmentPage } from './pages/enrollment/EnrollmentPage';
import { GradesPage } from './pages/grades/GradesPage';
import { AcademicRecordsPage } from './pages/records/AcademicRecordsPage';
import { DocumentsPage } from './pages/documents/DocumentsPage';
import { GsaPage } from './pages/documents/GsaPage';
import { TranscriptsPage } from './pages/transcripts/TranscriptsPage';
import { CatalogPage } from './pages/catalog/CatalogPage';
import { TermsPage } from './pages/catalog/TermsPage';
import { SchedulesPage } from './pages/schedules/SchedulesPage';
import { UsersPage } from './pages/admin/UsersPage';
import { AuditPage } from './pages/admin/AuditPage';
import { InstructionsPage } from './pages/instructions/InstructionsPage';
import { TraineeHomePage } from './pages/portal/TraineeHomePage';
import { TraineeSchedulePage } from './pages/portal/TraineeSchedulePage';
import { TraineeRecordsPage } from './pages/portal/TraineeRecordsPage';
import { TraineeRequestsPage } from './pages/portal/TraineeRequestsPage';

/**
 * Routing.
 *
 * Every staff route is wrapped in RequireRole, which redirects a hand-typed
 * URL. That is a courtesy to the reader — the service layer refuses the call
 * regardless of which page managed to render.
 */
export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/*
        Public. Deliberately outside both layouts and outside RequireRole —
        an applicant has no account. The services behind these two routes are
        the only ones that skip the role check.
      */}
      <Route path="/apply" element={<ApplyPage />} />
      <Route path="/apply/status" element={<ApplyStatusPage />} />

      <Route element={<RootLayout />}>
        <Route
          path="/dashboard"
          element={
            <RequireRole roles={['REGISTRAR']}>
              <DashboardPage />
            </RequireRole>
          }
        />
        <Route
          path="/students"
          element={
            <RequireRole roles={['REGISTRAR']}>
              <StudentsPage />
            </RequireRole>
          }
        />
        <Route
          path="/enrollment"
          element={
            <RequireRole roles={['REGISTRAR']}>
              <EnrollmentPage />
            </RequireRole>
          }
        />
        <Route
          path="/grades"
          element={
            <RequireRole roles={['REGISTRAR']}>
              <GradesPage />
            </RequireRole>
          }
        />
        <Route
          path="/records"
          element={
            <RequireRole roles={['REGISTRAR']}>
              <AcademicRecordsPage />
            </RequireRole>
          }
        />
        <Route
          path="/documents"
          element={
            <RequireRole roles={['REGISTRAR']}>
              <DocumentsPage />
            </RequireRole>
          }
        />
        <Route
          path="/gsa"
          element={
            <RequireRole roles={['REGISTRAR']}>
              <GsaPage />
            </RequireRole>
          }
        />
        <Route
          path="/transcripts"
          element={
            <RequireRole roles={['REGISTRAR']}>
              <TranscriptsPage />
            </RequireRole>
          }
        />
        <Route
          path="/catalog"
          element={
            <RequireRole roles={['REGISTRAR']}>
              <CatalogPage />
            </RequireRole>
          }
        />
        <Route
          path="/terms"
          element={
            <RequireRole roles={['REGISTRAR']}>
              <TermsPage />
            </RequireRole>
          }
        />
        <Route
          path="/schedules"
          element={
            <RequireRole roles={['REGISTRAR']}>
              <SchedulesPage />
            </RequireRole>
          }
        />
        <Route
          path="/users"
          element={
            <RequireRole roles={['REGISTRAR']}>
              <UsersPage />
            </RequireRole>
          }
        />
        <Route
          path="/audit"
          element={
            <RequireRole roles={['REGISTRAR']}>
              <AuditPage />
            </RequireRole>
          }
        />
        <Route
          path="/instructions"
          element={
            <RequireRole roles={['REGISTRAR']}>
              <InstructionsPage />
            </RequireRole>
          }
        />
        <Route
          path="/notifications"
          element={
            <RequireRole roles={['REGISTRAR']}>
              <NotificationsPage />
            </RequireRole>
          }
        />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />
      </Route>

      <Route element={<TraineeLayout />}>
        <Route path="/portal" element={<TraineeHomePage />} />
        <Route path="/portal/schedule" element={<TraineeSchedulePage />} />
        <Route path="/portal/records" element={<TraineeRecordsPage />} />
        <Route path="/portal/requests" element={<TraineeRequestsPage />} />
        <Route path="/portal/notifications" element={<NotificationsPage />} />
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
