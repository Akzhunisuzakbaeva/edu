import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AppShell from "./layout/AppShell";

import QuizPicker from "./components/games/QuizPicker";
import QuizGame from "./components/games/QuizGame";
import QuizCreate from "./components/games/QuizCreate";

import SortingCreate from "./components/games/SortingCreate";
import SortingTemplateList from "./components/games/SortingTemplateList";
import SortingGame from "./components/games/SortingGame";
import GroupingGame from "./components/games/GroupingGame";
import PollGame from "./components/games/PollGame";
import MatchingGame from "./components/games/MatchingGame";
import FlashcardsGame from "./components/games/FlashcardsGame";
import CrosswordGame from "./components/games/CrosswordGame";

import TemplatesPage from "./pages/TemplatesPage";

import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";

import StudentDashboardPage from "./pages/student/StudentDashboardPage";
import StudentProfilePage from "./pages/student/StudentProfilePage";
import AssignmentPage from "./pages/student/AssignmentPage";
import StudentLessonPage from "./pages/student/StudentLessonPage";

import TeacherDashboardPage from "./pages/teacher/TeacherDashboardPage";
import TeacherProfilePage from "./pages/teacher/TeacherProfilePage";
import TeacherLessonsPage from "./pages/teacher/TeacherLessonsPage";

import EditorPage from "./editor/EditorPage";
import AnalyticsPage from "./pages/AnalyticsPage";

import RequireRole from "./routes/RequireRole";

import StudentLivePage from "./pages/live/StudentLivePage";
import TeacherLivePage from "./pages/live/TeacherLivePage";

export default function App() {
  return (
    <BrowserRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />

          {/* Redirects */}
          <Route path="/student" element={<Navigate to="/student/dashboard" replace />} />
          <Route path="/teacher" element={<Navigate to="/teacher/dashboard" replace />} />

          {/* Teacher pages */}
          <Route
            path="/teacher/dashboard"
            element={
              <RequireRole role="teacher">
                <TeacherDashboardPage />
              </RequireRole>
            }
          />
          <Route
            path="/teacher/live"
            element={
              <RequireRole role="teacher">
                <TeacherLivePage />
              </RequireRole>
            }
          />
          <Route
            path="/teacher/profile"
            element={
              <RequireRole role="teacher">
                <TeacherProfilePage />
              </RequireRole>
            }
          />
          <Route
            path="/teacher/lessons"
            element={
              <RequireRole role="teacher">
                <TeacherLessonsPage />
              </RequireRole>
            }
          />

          {/* Editor (teacher only) */}
          <Route
            path="/editor"
            element={
              <RequireRole role="teacher">
                <div className="p-4">
                  <EditorPage />
                </div>
              </RequireRole>
            }
          />

          {/* Analytics (teacher only) */}
          <Route
            path="/analytics"
            element={
              <RequireRole role="teacher">
                <AnalyticsPage />
              </RequireRole>
            }
          />

          {/* Student pages */}
          <Route
            path="/student/dashboard"
            element={
              <RequireRole role="student">
                <StudentDashboardPage />
              </RequireRole>
            }
          />
          <Route
            path="/student/profile"
            element={
              <RequireRole role="student">
                <StudentProfilePage />
              </RequireRole>
            }
          />
          <Route
            path="/student/lessons/:id"
            element={
              <RequireRole role="student">
                <StudentLessonPage />
              </RequireRole>
            }
          />
          <Route
            path="/student/assignments/:id"
            element={
              <RequireRole role="student">
                <AssignmentPage />
              </RequireRole>
            }
          />
          <Route
            path="/student/live"
            element={
              <RequireRole role="student">
                <StudentLivePage />
              </RequireRole>
            }
          />

          {/* Games */}
          <Route
            path="/game/quiz"
            element={
              <RequireRole role="teacher">
                <QuizPicker />
              </RequireRole>
            }
          />
          <Route
            path="/game/quiz/create"
            element={
              <RequireRole role="teacher">
                <QuizCreate />
              </RequireRole>
            }
          />
          <Route
            path="/game/quiz/:id"
            element={
              <RequireRole role={["student", "teacher"]}>
                <QuizGame />
              </RequireRole>
            }
          />

          <Route
            path="/game/templates/create"
            element={
              <RequireRole role="teacher">
                <TemplatesPage />
              </RequireRole>
            }
          />
          <Route
            path="/game/templates/sorting/create"
            element={
              <RequireRole role="teacher">
                <SortingCreate />
              </RequireRole>
            }
          />
          <Route
            path="/game/templates/sorting"
            element={
              <RequireRole role="teacher">
                <SortingTemplateList />
              </RequireRole>
            }
          />
          <Route
            path="/game/sorting/:id"
            element={
              <RequireRole role="student">
                <SortingGame />
              </RequireRole>
            }
          />
          <Route
            path="/game/grouping"
            element={
              <RequireRole role="student">
                <GroupingGame />
              </RequireRole>
            }
          />
          <Route
            path="/game/poll/:id"
            element={
              <RequireRole role="student">
                <PollGame />
              </RequireRole>
            }
          />
          <Route
            path="/game/flashcards/:id"
            element={
              <RequireRole role="student">
                <FlashcardsGame />
              </RequireRole>
            }
          />
          <Route
            path="/game/crossword/:id"
            element={
              <RequireRole role="student">
                <CrosswordGame />
              </RequireRole>
            }
          />
          <Route
            path="/game/matching/:id"
            element={
              <RequireRole role="student">
                <MatchingGame />
              </RequireRole>
            }
          />
        </Routes>
      </AppShell>
    </BrowserRouter>
  );
}
