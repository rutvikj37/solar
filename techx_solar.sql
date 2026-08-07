-- phpMyAdmin SQL Dump
-- version 5.1.1deb5ubuntu1
-- https://www.phpmyadmin.net/
--
-- Host: localhost:3306
-- Generation Time: Aug 07, 2026 at 09:26 AM
-- Server version: 10.6.23-MariaDB-0ubuntu0.22.04.1
-- PHP Version: 8.2.32

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `techx_solar`
--

-- --------------------------------------------------------

--
-- Table structure for table `admin_credit_adjustments`
--

CREATE TABLE `admin_credit_adjustments` (
  `id` int(10) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED NOT NULL,
  `admin_id` int(10) UNSIGNED NOT NULL,
  `amount` int(11) NOT NULL,
  `balance_after` int(11) NOT NULL,
  `mode` varchar(10) NOT NULL DEFAULT 'add',
  `note` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `admin_credit_adjustments`
--

INSERT INTO `admin_credit_adjustments` (`id`, `user_id`, `admin_id`, `amount`, `balance_after`, `mode`, `note`, `created_at`) VALUES
(1, 6, 5, 0, 180, 'set', NULL, '2026-08-07 08:23:21'),
(2, 6, 5, 0, 180, 'set', NULL, '2026-08-07 08:23:24'),
(3, 6, 5, 196, 376, 'add', NULL, '2026-08-07 08:23:30');

-- --------------------------------------------------------

--
-- Table structure for table `ai_calling_appointments`
--

CREATE TABLE `ai_calling_appointments` (
  `id` int(10) UNSIGNED NOT NULL,
  `call_record_id` int(10) UNSIGNED NOT NULL,
  `lead_id` int(10) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED NOT NULL,
  `appointment_id` int(10) UNSIGNED DEFAULT NULL,
  `agency_name` varchar(255) DEFAULT NULL,
  `agency_zip` varchar(10) DEFAULT NULL,
  `scheduled_at` datetime NOT NULL,
  `duration_minutes` int(11) NOT NULL DEFAULT 30,
  `confirmation_sms_sent` tinyint(1) NOT NULL DEFAULT 0,
  `confirmation_email_sent` tinyint(1) NOT NULL DEFAULT 0,
  `google_calendar_event_id` varchar(255) DEFAULT NULL,
  `outlook_event_id` varchar(255) DEFAULT NULL,
  `status` enum('confirmed','cancelled','rescheduled','completed','no_show') NOT NULL DEFAULT 'confirmed',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `reminder_24h_sent` tinyint(1) NOT NULL DEFAULT 0,
  `reminder_1h_sent` tinyint(1) NOT NULL DEFAULT 0,
  `invite_link` varchar(512) DEFAULT NULL,
  `agency_id` int(10) UNSIGNED DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `ai_calling_appointments`
--

INSERT INTO `ai_calling_appointments` (`id`, `call_record_id`, `lead_id`, `user_id`, `appointment_id`, `agency_name`, `agency_zip`, `scheduled_at`, `duration_minutes`, `confirmation_sms_sent`, `confirmation_email_sent`, `google_calendar_event_id`, `outlook_event_id`, `status`, `created_at`, `reminder_24h_sent`, `reminder_1h_sent`, `invite_link`, `agency_id`) VALUES
(1, 19, 62, 5, 1, NULL, NULL, '2026-08-07 09:00:00', 30, 0, 0, NULL, NULL, 'confirmed', '2026-08-07 06:02:32', 0, 0, NULL, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `ai_calling_audit_log`
--

CREATE TABLE `ai_calling_audit_log` (
  `id` int(10) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED NOT NULL,
  `action` varchar(100) NOT NULL,
  `entity_type` varchar(50) DEFAULT NULL,
  `entity_id` int(10) UNSIGNED DEFAULT NULL,
  `details` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`details`)),
  `ip_address` varchar(45) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `ai_calling_audit_log`
--

INSERT INTO `ai_calling_audit_log` (`id`, `user_id`, `action`, `entity_type`, `entity_id`, `details`, `ip_address`, `created_at`) VALUES
(1, 5, 'call_completed', 'ai_call_record', 22, '{\"disposition\":\"callback\",\"qaScore\":40,\"provider\":\"openai\"}', NULL, '2026-08-07 07:36:59'),
(2, 5, 'call_completed', 'ai_call_record', 22, '{\"disposition\":\"callback\",\"qaScore\":40,\"provider\":\"openai\"}', NULL, '2026-08-07 07:37:00'),
(3, 5, 'call_completed', 'ai_call_record', 22, '{\"disposition\":\"callback\",\"qaScore\":40,\"provider\":\"openai\"}', NULL, '2026-08-07 07:37:00'),
(4, 5, 'call_completed', 'ai_call_record', 23, '{\"disposition\":\"no_disposition\",\"qaScore\":85,\"provider\":\"elevenlabs\"}', NULL, '2026-08-07 07:40:13'),
(5, 5, 'call_completed', 'ai_call_record', 23, '{\"disposition\":\"qualified\",\"qaScore\":85,\"provider\":\"elevenlabs\"}', NULL, '2026-08-07 07:40:15'),
(6, 5, 'call_completed', 'ai_call_record', 23, '{\"disposition\":\"callback\",\"qaScore\":85,\"provider\":\"elevenlabs\"}', NULL, '2026-08-07 07:40:24'),
(7, 5, 'call_completed', 'ai_call_record', 24, '{\"disposition\":\"callback\",\"qaScore\":85,\"provider\":\"elevenlabs\"}', NULL, '2026-08-07 07:43:29'),
(8, 5, 'call_completed', 'ai_call_record', 24, '{\"disposition\":\"callback\",\"qaScore\":85,\"provider\":\"elevenlabs\"}', NULL, '2026-08-07 07:43:29'),
(9, 5, 'call_completed', 'ai_call_record', 25, '{\"disposition\":\"qualified\",\"qaScore\":60,\"provider\":\"elevenlabs\"}', NULL, '2026-08-07 07:57:35'),
(10, 5, 'call_completed', 'ai_call_record', 25, '{\"disposition\":\"qualified\",\"qaScore\":65,\"provider\":\"elevenlabs\"}', NULL, '2026-08-07 07:57:36'),
(11, 5, 'call_completed', 'ai_call_record', 25, '{\"disposition\":\"qualified\",\"qaScore\":60,\"provider\":\"elevenlabs\"}', NULL, '2026-08-07 07:57:37');

-- --------------------------------------------------------

--
-- Table structure for table `ai_calling_campaigns`
--

CREATE TABLE `ai_calling_campaigns` (
  `id` int(10) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED NOT NULL,
  `name` varchar(255) NOT NULL,
  `status` enum('draft','active','paused','completed','cancelled') NOT NULL DEFAULT 'draft',
  `caller_name` varchar(100) DEFAULT NULL,
  `business_name` varchar(255) DEFAULT NULL,
  `twilio_number` varchar(20) DEFAULT NULL,
  `elevenlabs_voice_id` varchar(100) DEFAULT NULL,
  `timezone` varchar(50) NOT NULL DEFAULT 'America/New_York',
  `calling_window_start` time NOT NULL DEFAULT '09:00:00',
  `calling_window_end` time NOT NULL DEFAULT '20:00:00',
  `calling_days` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`calling_days`)),
  `retry_attempts` int(11) NOT NULL DEFAULT 3,
  `retry_delay_minutes` int(11) NOT NULL DEFAULT 60,
  `max_call_duration_seconds` int(11) NOT NULL DEFAULT 300,
  `appointment_duration_minutes` int(11) NOT NULL DEFAULT 30,
  `system_prompt` text DEFAULT NULL,
  `greeting_script` text DEFAULT NULL,
  `qualification_questions` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`qualification_questions`)),
  `objection_responses` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`objection_responses`)),
  `booking_script` text DEFAULT NULL,
  `closing_script` text DEFAULT NULL,
  `total_leads` int(11) NOT NULL DEFAULT 0,
  `completed_calls` int(11) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `elevenlabs_agent_id` varchar(100) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `ai_calling_queue`
--

CREATE TABLE `ai_calling_queue` (
  `id` int(10) UNSIGNED NOT NULL,
  `campaign_id` int(10) UNSIGNED NOT NULL,
  `lead_id` int(10) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED NOT NULL,
  `priority` int(11) NOT NULL DEFAULT 0,
  `status` enum('pending','calling','answered','completed','no_answer','voicemail','callback','failed','do_not_call') NOT NULL DEFAULT 'pending',
  `attempt_count` int(11) NOT NULL DEFAULT 0,
  `max_attempts` int(11) NOT NULL DEFAULT 3,
  `next_attempt_at` datetime DEFAULT NULL,
  `last_attempt_at` datetime DEFAULT NULL,
  `callback_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `ai_calling_settings`
--

CREATE TABLE `ai_calling_settings` (
  `id` int(10) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED NOT NULL,
  `twilio_phone_number` varchar(20) DEFAULT NULL,
  `elevenlabs_api_key_encrypted` varchar(512) DEFAULT NULL,
  `elevenlabs_voice_id` varchar(100) DEFAULT NULL,
  `elevenlabs_agent_id` varchar(100) DEFAULT NULL,
  `openai_api_key_encrypted` varchar(512) DEFAULT NULL,
  `openai_model` varchar(50) NOT NULL DEFAULT 'gpt-4o',
  `google_calendar_token` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`google_calendar_token`)),
  `outlook_calendar_token` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`outlook_calendar_token`)),
  `default_business_name` varchar(255) DEFAULT NULL,
  `default_caller_name` varchar(100) DEFAULT NULL,
  `default_timezone` varchar(50) NOT NULL DEFAULT 'America/New_York',
  `business_hours_start` time NOT NULL DEFAULT '09:00:00',
  `business_hours_end` time NOT NULL DEFAULT '20:00:00',
  `daily_call_limit` int(11) NOT NULL DEFAULT 100,
  `concurrent_call_limit` int(11) NOT NULL DEFAULT 5,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `ai_calling_settings`
--

INSERT INTO `ai_calling_settings` (`id`, `user_id`, `twilio_phone_number`, `elevenlabs_api_key_encrypted`, `elevenlabs_voice_id`, `elevenlabs_agent_id`, `openai_api_key_encrypted`, `openai_model`, `google_calendar_token`, `outlook_calendar_token`, `default_business_name`, `default_caller_name`, `default_timezone`, `business_hours_start`, `business_hours_end`, `daily_call_limit`, `concurrent_call_limit`, `created_at`, `updated_at`) VALUES
(1, 5, '', NULL, 'EXAVITQu4vr4xnSDxMaL', '', NULL, 'gpt-4o', NULL, NULL, 'Solar Velocity', 'Emily', 'America/New_York', '09:00:00', '20:00:00', 100, 5, '2026-08-07 04:47:53', '2026-08-07 04:48:49');

-- --------------------------------------------------------

--
-- Table structure for table `ai_call_records`
--

CREATE TABLE `ai_call_records` (
  `id` int(10) UNSIGNED NOT NULL,
  `campaign_id` int(10) UNSIGNED DEFAULT NULL,
  `queue_id` int(10) UNSIGNED DEFAULT NULL,
  `lead_id` int(10) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED NOT NULL,
  `twilio_call_sid` varchar(64) DEFAULT NULL,
  `direction` enum('outbound','inbound') NOT NULL DEFAULT 'outbound',
  `status` enum('initiated','ringing','in_progress','completed','no_answer','busy','failed','voicemail','transferred') NOT NULL DEFAULT 'initiated',
  `disposition` enum('qualified','not_interested','callback','appointment_booked','wrong_number','do_not_call','voicemail_left','no_disposition') NOT NULL DEFAULT 'no_disposition',
  `duration_seconds` int(11) NOT NULL DEFAULT 0,
  `recording_url` varchar(1024) DEFAULT NULL,
  `recording_sid` varchar(64) DEFAULT NULL,
  `transcript` longtext DEFAULT NULL,
  `ai_summary` text DEFAULT NULL,
  `ai_notes` text DEFAULT NULL,
  `sentiment` enum('positive','neutral','negative','unknown') NOT NULL DEFAULT 'unknown',
  `lead_score_delta` int(11) NOT NULL DEFAULT 0,
  `qualification_data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`qualification_data`)),
  `started_at` datetime DEFAULT NULL,
  `ended_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `voice_provider` varchar(32) DEFAULT 'openai',
  `elevenlabs_agent_id` varchar(100) DEFAULT NULL,
  `qa_score` int(11) DEFAULT NULL,
  `qa_notes` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`qa_notes`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `ai_call_records`
--

INSERT INTO `ai_call_records` (`id`, `campaign_id`, `queue_id`, `lead_id`, `user_id`, `twilio_call_sid`, `direction`, `status`, `disposition`, `duration_seconds`, `recording_url`, `recording_sid`, `transcript`, `ai_summary`, `ai_notes`, `sentiment`, `lead_score_delta`, `qualification_data`, `started_at`, `ended_at`, `created_at`, `voice_provider`, `elevenlabs_agent_id`, `qa_score`, `qa_notes`) VALUES
(1, NULL, NULL, 45, 5, NULL, 'outbound', 'initiated', 'no_disposition', 0, NULL, NULL, NULL, NULL, NULL, 'unknown', 0, NULL, '2026-08-07 10:17:20', NULL, '2026-08-07 04:47:20', 'openai', NULL, NULL, NULL),
(2, NULL, NULL, 1, 1, 'CAsim_1786078098618_8ctowh', 'outbound', 'ringing', 'no_disposition', 0, NULL, NULL, NULL, NULL, NULL, 'unknown', 0, NULL, '2026-08-07 10:18:18', NULL, '2026-08-07 04:48:18', 'openai', NULL, NULL, NULL),
(3, NULL, NULL, 46, 1, 'CAsim_1786078108534_xyk8ry', 'outbound', 'ringing', 'no_disposition', 0, NULL, NULL, NULL, NULL, NULL, 'unknown', 0, NULL, '2026-08-07 10:18:28', NULL, '2026-08-07 04:48:28', 'openai', NULL, NULL, NULL),
(4, NULL, NULL, 47, 5, 'CAsim_1786078151882_djrrlk', 'outbound', 'ringing', 'no_disposition', 0, NULL, NULL, NULL, NULL, NULL, 'unknown', 0, NULL, '2026-08-07 10:19:11', NULL, '2026-08-07 04:49:11', 'openai', NULL, NULL, NULL),
(5, NULL, NULL, 48, 5, 'CAsim_1786078184379_ed0q3p', 'outbound', 'ringing', 'no_disposition', 0, NULL, NULL, NULL, NULL, NULL, 'unknown', 0, NULL, '2026-08-07 10:19:44', NULL, '2026-08-07 04:49:44', 'openai', NULL, NULL, NULL),
(6, NULL, NULL, 49, 5, 'CA9cdf8193b4bfcfa7fae07e1995456eb4', 'outbound', 'ringing', 'no_disposition', 0, NULL, NULL, NULL, NULL, NULL, 'unknown', 0, NULL, '2026-08-07 10:22:49', NULL, '2026-08-07 04:52:49', 'openai', NULL, NULL, NULL),
(7, NULL, NULL, 50, 5, 'CA06db82897d04b53c5601f169834ebed8', 'outbound', 'ringing', 'no_disposition', 0, NULL, NULL, NULL, NULL, NULL, 'unknown', 0, NULL, '2026-08-07 10:26:48', NULL, '2026-08-07 04:56:48', 'openai', NULL, NULL, NULL),
(8, NULL, NULL, 51, 5, 'CA1d036c9650e257f73f093ff8463fe4cd', 'outbound', 'ringing', 'no_disposition', 0, NULL, NULL, NULL, NULL, NULL, 'unknown', 0, NULL, '2026-08-07 10:27:59', NULL, '2026-08-07 04:57:59', 'openai', NULL, NULL, NULL),
(9, NULL, NULL, 52, 5, 'CAfac7f43635f2c59e01d888cb5ff79b40', 'outbound', 'ringing', 'no_disposition', 0, NULL, NULL, NULL, NULL, NULL, 'unknown', 0, NULL, '2026-08-07 10:33:06', NULL, '2026-08-07 05:03:06', 'openai', NULL, NULL, NULL),
(10, NULL, NULL, 53, 5, 'CA668fb337440cdff8a34a1674e5e3f7f2', 'outbound', 'initiated', 'no_disposition', 0, NULL, NULL, NULL, NULL, NULL, 'unknown', 0, NULL, '2026-08-07 10:35:51', NULL, '2026-08-07 05:05:51', 'openai', NULL, NULL, NULL),
(11, NULL, NULL, 54, 5, 'CA17f7a5989f81823824f2ebc2e9bc8ca3', 'outbound', 'initiated', 'no_disposition', 0, NULL, NULL, NULL, NULL, NULL, 'unknown', 0, NULL, '2026-08-07 10:37:32', NULL, '2026-08-07 05:07:32', 'openai', NULL, NULL, NULL),
(12, NULL, NULL, 55, 5, 'CAb7c559bf5042beb67f50db59981f7dd7', 'outbound', 'ringing', 'no_disposition', 0, NULL, NULL, NULL, NULL, NULL, 'unknown', 0, NULL, '2026-08-07 11:04:39', NULL, '2026-08-07 05:34:39', 'openai', NULL, NULL, NULL),
(13, NULL, NULL, 56, 5, 'CA0963e9a289950ff9196d026a0b53be5d', 'outbound', 'initiated', 'no_disposition', 0, NULL, NULL, NULL, NULL, NULL, 'unknown', 0, NULL, '2026-08-07 11:06:35', NULL, '2026-08-07 05:36:35', 'openai', NULL, NULL, NULL),
(14, NULL, NULL, 57, 5, 'CAfb74cb4db473ac610a4771594a5f816f', 'outbound', 'initiated', 'no_disposition', 0, NULL, NULL, NULL, NULL, NULL, 'unknown', 0, NULL, '2026-08-07 11:06:42', NULL, '2026-08-07 05:36:42', 'openai', NULL, NULL, NULL),
(15, NULL, NULL, 58, 5, 'CA325c166df02b329a8554ad6d610391f3', 'outbound', 'initiated', 'no_disposition', 0, NULL, NULL, NULL, NULL, NULL, 'unknown', 0, NULL, '2026-08-07 11:08:58', NULL, '2026-08-07 05:38:58', 'openai', NULL, NULL, NULL),
(16, NULL, NULL, 59, 5, 'CAe6e7120a00a22744a5070396d21c9093', 'outbound', 'ringing', 'no_disposition', 0, NULL, NULL, NULL, NULL, NULL, 'unknown', 0, NULL, '2026-08-07 11:18:06', NULL, '2026-08-07 05:48:06', 'openai', NULL, NULL, NULL),
(17, NULL, NULL, 60, 5, 'CA9580bd87a7a65304db5dd698a6ba6a69', 'outbound', 'in_progress', 'no_disposition', 0, NULL, NULL, NULL, NULL, NULL, 'unknown', 0, NULL, '2026-08-07 11:21:59', NULL, '2026-08-07 05:51:59', 'openai', NULL, NULL, NULL),
(18, NULL, NULL, 61, 5, 'CAd629775ba339af9fc3118dd682d147ac', 'outbound', 'completed', 'no_disposition', 0, NULL, NULL, 'AI: Hallo, hier ist\nCustomer: Hallo.\nAI: Hi, hier ist Emily von Solar Velocity. Ich weiß, ich komme ein bisschen überraschend – hast du gerade ungefähr 30 Sekunden Zeit? Sonst rufe ich\nAI: Kein Problem,\nCustomer: ¡Halo!\nAI: Alles gut, nimm dir gerne kurz Zeit. Bist du der Eigentümer des Hauses?\nCustomer: MBC 뉴스 이덕영입니다.\nAI: Alles klar, kein Stress.\nCustomer: Thank you.\nAI: Absolutely, I can switch over to English. Are you the homeowner, by the way?\nCustomer: Speak in English.\nCustomer: Hello\nCustomer: Just\nCustomer: Hello\nAI: Hi there, this is Emily with Solar Velocity. I know I caught you unexpectedly—do you have about 30 seconds? If not, I can call back at a better time.', 'The sales call was initiated by Emily from Solar Velocity, who attempted to confirm if the customer was the homeowner. The conversation faced language barriers, with the customer switching between languages and eventually requesting to continue in English. The call did not progress beyond the initial introduction.', 'Attempt to reach the customer again at a later time, ensuring language preferences are addressed upfront.', 'neutral', 0, '{\"isHomeowner\":null,\"monthlyElectricBill\":null,\"interestedInSolar\":null,\"interestedInConsultation\":null,\"preferredAppointmentTime\":null,\"spouseApprovalNeeded\":false,\"hasExistingSolar\":false,\"additionalNotes\":\"The customer switched languages multiple times and did not provide clear answers to qualification questions.\"}', '2026-08-07 11:25:18', '2026-08-07 05:56:13', '2026-08-07 05:55:18', 'openai', NULL, NULL, NULL),
(19, NULL, NULL, 62, 5, 'CAdafe03ffbe678dcfcfffa6f707f500cc', 'outbound', 'completed', 'no_disposition', 0, NULL, NULL, 'AI: Hi there, I’m Emily with Solar Velocity. Do you have 30 seconds to chat?\nCustomer: Yes\nAI: Great, thanks for that. Are you the homeowner at 123 Solar Test Way?\nCustomer: Thank you.\nCustomer: Yes\nAI: Perfect. I’ll go ahead and mark that down.\nAI: What’s your approximate monthly electric bill, if you don’t mind me asking?\nCustomer: $250\nAI: Got it, about $250. Would you be open to a free solar savings consultation?\nCustomer: Yes.\nAI: Awesome. I have a local solar specialist available Tuesday at 3 PM or Wednesday morning—which works better for you?\nCustomer: when it\'s been one week.\nAI: We’ve got 9 AM, 10 AM, or 11 AM available. What sounds best for you?\nCustomer: Their name\nAI: Awesome, you\'re all set! You\'ll get a text confirmation shortly. Thanks so much, Personal Test Lead!', 'Emily from Solar Velocity spoke with a homeowner about their interest in solar energy. The homeowner, who has a monthly electric bill of $250, agreed to a free solar savings consultation and scheduled an appointment for the following week.', 'Error during processing: Incorrect datetime value: \'Wednesday at 10 AM\' for column `techx_solar`.`appointments`.`scheduled_at` at row 1', 'positive', 25, '{\"isHomeowner\":true,\"monthlyElectricBill\":\"$250\",\"interestedInSolar\":true,\"interestedInConsultation\":true,\"preferredAppointmentTime\":\"Wednesday at 10 AM\",\"spouseApprovalNeeded\":false,\"hasExistingSolar\":false,\"additionalNotes\":\"Customer prefers an appointment one week from now.\"}', '2026-08-07 11:31:18', '2026-08-07 06:02:46', '2026-08-07 06:01:18', 'openai', NULL, NULL, NULL),
(20, NULL, NULL, 63, 5, 'CAd26677c86bde2f2188fae4c620bc6e67', 'outbound', 'completed', 'callback', 0, NULL, NULL, 'AI: Hi there! This is Emily with Solar Velocity—do you have 30 seconds to chat?\nAI: No worries at all. Is there a better time today for a quick call?\nCustomer: Thank you.\nAI: Perfect, I\'ll give you a call then. Talk to you soon!\nAI: Absolutely, we can move it. What time works best for you today?\nCustomer: No!\nCustomer: Who is this?\nAI: I’m Emily with Solar Velocity. Just checking if you’ve got a quick moment now or prefer a later time.\nCustomer: How do you get my number?\nAI: Your property showed up in our solar savings database as having great potential.', 'Emily from Solar Velocity attempted to contact a potential customer about solar savings opportunities. The customer was initially confused and questioned how their number was obtained. Emily offered to call back at a more convenient time.', 'Schedule a follow-up call at a time specified by the customer to discuss solar savings opportunities.', 'neutral', 0, '{\"isHomeowner\":null,\"monthlyElectricBill\":null,\"interestedInSolar\":null,\"interestedInConsultation\":null,\"preferredAppointmentTime\":null,\"spouseApprovalNeeded\":false,\"hasExistingSolar\":false,\"additionalNotes\":\"The customer was not responsive to scheduling a call and questioned how their number was obtained.\"}', '2026-08-07 11:42:34', '2026-08-07 06:13:28', '2026-08-07 06:12:34', 'openai', NULL, NULL, NULL),
(21, NULL, NULL, 64, 5, 'CAc822a50d54402d766a356a27af3f5435', 'outbound', 'completed', 'not_interested', 0, NULL, NULL, 'AI: Hi there! This is Emily from Solar Velocity. Do you have 30 seconds to chat?\nCustomer: Bye there. That\'s a thing.\nAI: Absolutely, thanks for taking the time. Are you the homeowner there?', 'The sales call was initiated by Emily from Solar Velocity, but the customer did not engage in a meaningful conversation and ended the call abruptly.', 'No further action is recommended as the customer was not interested.', 'neutral', -10, '{\"isHomeowner\":null,\"monthlyElectricBill\":null,\"interestedInSolar\":null,\"interestedInConsultation\":null,\"preferredAppointmentTime\":null,\"spouseApprovalNeeded\":false,\"hasExistingSolar\":false,\"additionalNotes\":\"The customer did not provide any clear responses to the questions asked.\"}', '2026-08-07 11:45:19', '2026-08-07 06:15:43', '2026-08-07 06:15:19', 'openai', NULL, NULL, NULL),
(22, NULL, NULL, 65, 5, 'CA1dfcbcbdef98ba8aba93d2dc80ec605d', 'outbound', 'completed', 'callback', 14, 'https://api.twilio.com/2010-04-01/Accounts/AC78b50faf639d13ba49f224738a2a3409/Recordings/RE4cf8dd2f9d1521b027f04417e08d73fd', 'RE4cf8dd2f9d1521b027f04417e08d73fd', 'AI: Hi there, thanks for taking the call. This may be recorded. I’m here to help—do you have 30 seconds to chat?\nAI: Got it. What time today works better for a quick call?', 'The AI initiated a call, informing the recipient that the call may be recorded and asked if they had 30 seconds to chat. The AI then inquired about a suitable time for a quick call later in the day.', 'Follow up with the recipient at the suggested time for a more detailed conversation.', 'neutral', 0, '{\"isHomeowner\":null,\"monthlyElectricBill\":null,\"interestedInSolar\":null,\"interestedInConsultation\":null,\"preferredAppointmentTime\":null,\"spouseApprovalNeeded\":false,\"hasExistingSolar\":false,\"additionalNotes\":\"The transcript does not provide any specific information.\"}', '2026-08-07 13:06:32', '2026-08-07 07:37:00', '2026-08-07 07:36:32', 'openai', NULL, 40, '{\"score\":40,\"talkRatio\":\"agent_heavy\",\"interruptionRisk\":\"high\",\"fillerDensity\":\"low\",\"bookingAttempted\":true,\"activeListening\":false,\"notes\":\"The agent did not allow the customer to respond, leading to a high interruption risk. Active listening was not demonstrated, as the agent proceeded with a follow-up question without confirming the customer\'s availability or interest. Ensure to pause for customer responses and engage in active listening to improve interaction quality.\"}'),
(23, NULL, NULL, 66, 5, 'CAec743e04927b9df8a2376dae27de1a34', 'outbound', 'completed', 'callback', 18, 'https://api.twilio.com/2010-04-01/Accounts/AC78b50faf639d13ba49f224738a2a3409/Recordings/REf40450c62e8b060ef8915076bfe4c556', 'REf40450c62e8b060ef8915076bfe4c556', 'AI: Hi Personal Test Lead, this is Emily with Solar Velocity. This call may be recorded for quality. I know I caught you unexpectedly — do you have about 30 seconds?', 'Emily from Solar Velocity reached out to a potential lead, Personal Test Lead, to discuss solar energy solutions. The call was brief, and the lead was not available to engage further at the moment.', 'Schedule a follow-up call at a more convenient time for the lead.', 'neutral', 0, '{\"isHomeowner\":null,\"monthlyElectricBill\":null,\"interestedInSolar\":null,\"interestedInConsultation\":null,\"preferredAppointmentTime\":null,\"spouseApprovalNeeded\":false,\"hasExistingSolar\":false,\"additionalNotes\":\"\"}', '2026-08-07 13:09:41', '2026-08-07 07:40:24', '2026-08-07 07:39:41', 'elevenlabs', 'agent_8701kzdjkkwge6mtqs0my1pax37t', 85, '{\"score\":85,\"talkRatio\":\"agent_heavy\",\"interruptionRisk\":\"low\",\"fillerDensity\":\"low\",\"bookingAttempted\":false,\"activeListening\":true,\"notes\":\"The agent introduced herself clearly and asked for permission to continue, which is good practice. However, the call did not progress to a booking attempt. Encourage the agent to steer the conversation towards setting up a follow-up or appointment.\"}'),
(24, NULL, NULL, 67, 5, 'CAa4f361bca813de386131f1e4528ad3b4', 'outbound', 'completed', 'callback', 20, 'https://api.twilio.com/2010-04-01/Accounts/AC78b50faf639d13ba49f224738a2a3409/Recordings/RE20cdae84f02755c3b5345f8cd6ce0cf3', 'RE20cdae84f02755c3b5345f8cd6ce0cf3', 'AI: Hi Personal Test Lead, this is Emily with Solar Velocity. This call may be recorded for quality. I know I caught you unexpectedly — do you have about thirty seconds?', 'Emily from Solar Velocity reached out to a potential lead to discuss solar energy solutions. The call was brief and primarily focused on confirming the lead\'s availability for a longer conversation.', 'Schedule a follow-up call to discuss solar solutions in detail.', 'neutral', 5, '{\"isHomeowner\":null,\"monthlyElectricBill\":null,\"interestedInSolar\":null,\"interestedInConsultation\":null,\"preferredAppointmentTime\":null,\"spouseApprovalNeeded\":false,\"hasExistingSolar\":false,\"additionalNotes\":\"\"}', '2026-08-07 13:12:56', '2026-08-07 07:43:29', '2026-08-07 07:42:56', 'elevenlabs', 'agent_3201kzdjshjmeh7vsy6pkbjr0d4n', 85, '{\"score\":85,\"talkRatio\":\"agent_heavy\",\"interruptionRisk\":\"low\",\"fillerDensity\":\"low\",\"bookingAttempted\":false,\"activeListening\":true,\"notes\":\"The introduction was clear and concise, with a polite request for time. However, there was no attempt to book a follow-up or next steps, which could improve the call\'s effectiveness. Ensure to guide the conversation towards a specific goal or action.\"}'),
(25, NULL, NULL, 68, 5, 'CA0d934b469a9bb6b8f634f9ac98cee250', 'outbound', 'completed', 'qualified', 61, 'https://api.twilio.com/2010-04-01/Accounts/AC78b50faf639d13ba49f224738a2a3409/Recordings/RE0c5c7cbd36a2623d5a487271f6579408', 'RE0c5c7cbd36a2623d5a487271f6579408', 'Customer: Hello?\nAI: Hi Personal Test Lead, this is Emily with Solar Velocity. This call may be recorded for quality. I know I caught you unexpectedly — do you have about thirty seconds?\nCustomer: Hi, Pragya.\nAI: [slow] Oh, [slow] sorry about that. It\'s Personal Test Lead. This is Emily with Solar Velocity. This call may be recorded for quality. I know I caught you unexpectedly — do you have about thirty seconds?\nCustomer: Yes.\nAI: Great. I\'m calling because your property shows great potential for solar savings. Are you the homeowner there?The user said \"Yes\" to having thirty seconds. I should now proceed with the first qualification question: \"Are you the homeowner there?\" This aligns with the conversation goals and qualification questions provided.\nCustomer: How do you get my number?\nAI: Your property showed strong solar potential in our savings database. Are you the homeowner?\nCustomer: What is the company name?\nAI: It\'s Solar Velocity. Are you the homeowner at the property?The user asked for the company name. I need to provide the company name, \"Solar Velocity\", and then return to the qualification question about being the homeowner.\nCustomer: Yes.\nAI: Great. What\'s your approximate monthly electric bill?', 'Emily from Solar Velocity contacted a potential customer to discuss solar savings opportunities for their property. The customer confirmed they are the homeowner and inquired about the company\'s name before the call proceeded to discuss their monthly electric bill.', 'Follow up with the customer to discuss their monthly electric bill and provide more information on solar savings options.', 'neutral', 10, '{\"isHomeowner\":true,\"monthlyElectricBill\":null,\"interestedInSolar\":null,\"interestedInConsultation\":null,\"preferredAppointmentTime\":null,\"spouseApprovalNeeded\":false,\"hasExistingSolar\":false,\"additionalNotes\":\"Customer confirmed they are the homeowner. The conversation was interrupted by questions about how the number was obtained and the company name.\"}', '2026-08-07 13:26:22', '2026-08-07 07:57:37', '2026-08-07 07:56:22', 'elevenlabs', 'agent_3501kzdkj4pqfrmsx7sr5nb4dyzj', 60, '{\"score\":60,\"talkRatio\":\"agent_heavy\",\"interruptionRisk\":\"medium\",\"fillerDensity\":\"medium\",\"bookingAttempted\":false,\"activeListening\":false,\"notes\":\"The agent repeated the introduction unnecessarily and failed to address the customer\'s question about how their number was obtained, which could build trust. The agent also missed an opportunity to engage in active listening by not acknowledging the customer\'s concerns. The conversation was agent-heavy, with a focus on pushing through the script rather than engaging with the customer\'s responses. Consider improving responsiveness and building rapport to enhance the call quality.\"}');

-- --------------------------------------------------------

--
-- Table structure for table `ai_knowledge_base`
--

CREATE TABLE `ai_knowledge_base` (
  `id` int(10) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED NOT NULL,
  `category` varchar(100) NOT NULL,
  `title` varchar(255) NOT NULL,
  `content` text NOT NULL,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `ai_solar_agencies`
--

CREATE TABLE `ai_solar_agencies` (
  `id` int(10) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED NOT NULL,
  `name` varchar(255) NOT NULL,
  `zip_codes` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`zip_codes`)),
  `states` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`states`)),
  `phone` varchar(20) DEFAULT NULL,
  `email` varchar(190) DEFAULT NULL,
  `calendar_link` varchar(512) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `ai_voicemail_templates`
--

CREATE TABLE `ai_voicemail_templates` (
  `id` int(10) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED NOT NULL,
  `name` varchar(100) NOT NULL,
  `script` text NOT NULL,
  `is_default` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `api_logs`
--

CREATE TABLE `api_logs` (
  `id` int(10) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED DEFAULT NULL,
  `api_name` varchar(255) NOT NULL,
  `endpoint` varchar(255) NOT NULL,
  `status_code` int(11) NOT NULL,
  `timestamp` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `api_logs`
--

INSERT INTO `api_logs` (`id`, `user_id`, `api_name`, `endpoint`, `status_code`, `timestamp`) VALUES
(1, 2, 'Google Maps', 'Geocoding API', 200, '2026-07-15 09:54:21'),
(2, 2, 'Google Solar', 'Solar Potential Query', 200, '2026-07-15 09:54:21'),
(3, 2, 'ATTOM', 'Property Enrichment', 200, '2026-07-15 09:54:21'),
(4, 2, 'Apollo', 'Contact Details Enrichment', 200, '2026-07-15 09:54:21');

-- --------------------------------------------------------

--
-- Table structure for table `api_usage_daily`
--

CREATE TABLE `api_usage_daily` (
  `provider` varchar(64) NOT NULL,
  `usage_date` date NOT NULL,
  `success_count` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `error_count` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `total_ms` bigint(20) UNSIGNED NOT NULL DEFAULT 0,
  `call_count` int(10) UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `api_usage_daily`
--

INSERT INTO `api_usage_daily` (`provider`, `usage_date`, `success_count`, `error_count`, `total_ms`, `call_count`) VALUES
('apollo', '2026-08-02', 1, 0, 1329, 1),
('apollo', '2026-08-06', 1, 0, 3430, 1),
('apollo', '2026-08-07', 4, 0, 13245, 4),
('google_maps', '2026-08-02', 13, 0, 3252, 13),
('google_maps', '2026-08-03', 4, 0, 882, 4),
('google_maps', '2026-08-06', 11, 0, 4386, 11),
('google_maps', '2026-08-07', 46, 5, 14389, 51),
('google_solar', '2026-08-02', 8, 0, 9652, 8),
('google_solar', '2026-08-03', 5, 0, 6582, 5),
('google_solar', '2026-08-06', 7, 0, 10780, 7),
('google_solar', '2026-08-07', 28, 0, 40813, 28),
('nrel', '2026-08-02', 8, 21, 17778, 29),
('nrel', '2026-08-03', 6, 14, 9546, 20),
('nrel', '2026-08-06', 0, 28, 14895, 28),
('nrel', '2026-08-07', 0, 52, 18823, 52),
('rentcast', '2026-08-02', 7, 8, 7943, 15),
('rentcast', '2026-08-03', 6, 0, 3212, 6),
('rentcast', '2026-08-06', 13, 0, 14969, 13),
('rentcast', '2026-08-07', 56, 0, 34874, 56),
('stripe', '2026-08-07', 3, 0, 17, 3),
('tracerfy', '2026-08-02', 6, 0, 8647, 6),
('tracerfy', '2026-08-03', 5, 0, 7228, 5),
('tracerfy', '2026-08-06', 6, 1, 14989, 7),
('tracerfy', '2026-08-07', 10, 3, 37529, 13),
('twilio', '2026-08-07', 23, 3, 20077, 26),
('verifalia', '2026-08-02', 5, 0, 9707, 5),
('verifalia', '2026-08-03', 5, 0, 5447, 5),
('verifalia', '2026-08-06', 6, 0, 23527, 6),
('verifalia', '2026-08-07', 6, 0, 14968, 6);

-- --------------------------------------------------------

--
-- Table structure for table `appointments`
--

CREATE TABLE `appointments` (
  `id` int(10) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED NOT NULL,
  `lead_id` int(10) UNSIGNED DEFAULT NULL,
  `title` varchar(255) NOT NULL,
  `scheduled_at` datetime NOT NULL,
  `duration_minutes` int(11) NOT NULL DEFAULT 60,
  `status` varchar(50) NOT NULL DEFAULT 'scheduled',
  `location` varchar(255) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `reminder_sent` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `appointments`
--

INSERT INTO `appointments` (`id`, `user_id`, `lead_id`, `title`, `scheduled_at`, `duration_minutes`, `status`, `location`, `notes`, `reminder_sent`, `created_at`, `updated_at`) VALUES
(1, 5, 62, 'AI-Booked Solar Consultation', '2026-08-07 09:00:00', 30, 'scheduled', '', 'Booked by AI caller during live conversation. Call Record: 19', 0, '2026-08-07 06:02:32', '2026-08-07 06:02:32');

-- --------------------------------------------------------

--
-- Table structure for table `bulk_scans`
--

CREATE TABLE `bulk_scans` (
  `id` int(10) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED NOT NULL,
  `search_type` varchar(255) NOT NULL,
  `search_query` varchar(255) NOT NULL,
  `status` varchar(255) NOT NULL DEFAULT 'running',
  `properties_found` int(11) DEFAULT 0,
  `properties_scanned` int(11) DEFAULT 0,
  `qualified_leads` int(11) DEFAULT 0,
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `bulk_scans`
--

INSERT INTO `bulk_scans` (`id`, `user_id`, `search_type`, `search_query`, `status`, `properties_found`, `properties_scanned`, `qualified_leads`, `created_at`) VALUES
(1, 2, 'zip', '95350', 'completed', 450, 450, 48, '2026-07-15 09:54:21');

-- --------------------------------------------------------

--
-- Table structure for table `drip_campaigns`
--

CREATE TABLE `drip_campaigns` (
  `id` int(10) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED NOT NULL,
  `name` varchar(100) NOT NULL,
  `status` enum('active','paused') NOT NULL DEFAULT 'active',
  `trigger_min_score` int(11) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `enrollment_mode` enum('all_leads','score_gated','manual') NOT NULL DEFAULT 'score_gated',
  `description` text DEFAULT NULL,
  `timezone` varchar(50) NOT NULL DEFAULT 'America/New_York',
  `quiet_hours_start` time NOT NULL DEFAULT '09:00:00',
  `quiet_hours_end` time NOT NULL DEFAULT '20:00:00',
  `stop_on_reply` tinyint(1) NOT NULL DEFAULT 1,
  `stop_on_statuses` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`stop_on_statuses`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `drip_enrollments`
--

CREATE TABLE `drip_enrollments` (
  `id` int(10) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED NOT NULL,
  `campaign_id` int(10) UNSIGNED NOT NULL,
  `lead_id` int(10) UNSIGNED NOT NULL,
  `current_step` int(11) NOT NULL DEFAULT 1,
  `next_run_at` timestamp NULL DEFAULT NULL,
  `status` enum('active','completed','cancelled') NOT NULL DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `drip_steps`
--

CREATE TABLE `drip_steps` (
  `id` int(10) UNSIGNED NOT NULL,
  `campaign_id` int(10) UNSIGNED NOT NULL,
  `step_order` int(11) NOT NULL,
  `delay_days` int(11) NOT NULL DEFAULT 0,
  `action_type` enum('sms','email','ai_call') NOT NULL,
  `subject` varchar(200) DEFAULT NULL,
  `template_content` text NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `delay_hours` int(11) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `drip_step_executions`
--

CREATE TABLE `drip_step_executions` (
  `id` int(10) UNSIGNED NOT NULL,
  `enrollment_id` int(10) UNSIGNED NOT NULL,
  `step_id` int(10) UNSIGNED NOT NULL,
  `lead_id` int(10) UNSIGNED NOT NULL,
  `channel` enum('sms','email','ai_call') NOT NULL,
  `status` enum('sent','failed','skipped') NOT NULL,
  `error_message` text DEFAULT NULL,
  `external_id` varchar(255) DEFAULT NULL,
  `executed_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `drip_triggers`
--

CREATE TABLE `drip_triggers` (
  `id` int(10) UNSIGNED NOT NULL,
  `campaign_id` int(10) UNSIGNED NOT NULL,
  `trigger_type` enum('lead_created','status_change','min_score','has_phone','has_email','territory') NOT NULL,
  `trigger_config` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`trigger_config`)),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `invoices`
--

CREATE TABLE `invoices` (
  `id` int(10) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED NOT NULL,
  `stripe_session_id` varchar(255) DEFAULT NULL,
  `package_id` varchar(50) NOT NULL,
  `amount_cents` int(11) NOT NULL DEFAULT 0,
  `credits` int(11) NOT NULL DEFAULT 0,
  `status` varchar(50) NOT NULL DEFAULT 'pending',
  `method` varchar(100) DEFAULT 'card',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `stripe_subscription_id` varchar(255) DEFAULT NULL,
  `stripe_invoice_id` varchar(255) DEFAULT NULL,
  `billing_reason` varchar(50) DEFAULT 'initial',
  `razorpay_payment_id` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `invoices`
--

INSERT INTO `invoices` (`id`, `user_id`, `stripe_session_id`, `package_id`, `amount_cents`, `credits`, `status`, `method`, `created_at`, `stripe_subscription_id`, `stripe_invoice_id`, `billing_reason`, `razorpay_payment_id`) VALUES
(1, 3, NULL, 'Starter', 49900, 20, 'paid', 'dev_credit', '2026-07-31 15:22:10', NULL, NULL, 'initial', NULL),
(2, 6, NULL, 'starter', 29900, 20, 'paid', 'dev_subscription', '2026-08-07 08:33:27', NULL, NULL, 'initial', NULL),
(3, 6, NULL, 'starter', 29900, 20, 'paid', 'dev_subscription', '2026-08-07 08:33:28', NULL, NULL, 'initial', NULL),
(4, 6, NULL, 'starter', 29900, 20, 'paid', 'dev_subscription', '2026-08-07 08:33:29', NULL, NULL, 'initial', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `knex_migrations`
--

CREATE TABLE `knex_migrations` (
  `id` int(10) UNSIGNED NOT NULL,
  `name` varchar(255) DEFAULT NULL,
  `batch` int(11) DEFAULT NULL,
  `migration_time` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `knex_migrations`
--

INSERT INTO `knex_migrations` (`id`, `name`, `batch`, `migration_time`) VALUES
(1, '20260715000000_create_tables.ts', 1, '2026-07-15 04:24:20');

-- --------------------------------------------------------

--
-- Table structure for table `knex_migrations_lock`
--

CREATE TABLE `knex_migrations_lock` (
  `index` int(10) UNSIGNED NOT NULL,
  `is_locked` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `knex_migrations_lock`
--

INSERT INTO `knex_migrations_lock` (`index`, `is_locked`) VALUES
(1, 0);

-- --------------------------------------------------------

--
-- Table structure for table `leads`
--

CREATE TABLE `leads` (
  `id` int(10) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED NOT NULL,
  `address` varchar(255) NOT NULL,
  `latitude` decimal(10,8) DEFAULT NULL,
  `longitude` decimal(11,8) DEFAULT NULL,
  `owner_name` varchar(255) DEFAULT NULL,
  `phone` varchar(255) DEFAULT NULL,
  `phone_type` varchar(255) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `email_status` varchar(255) DEFAULT NULL,
  `linkedin` varchar(500) DEFAULT NULL,
  `mailing_address` varchar(255) DEFAULT NULL,
  `property_value` decimal(12,2) DEFAULT NULL,
  `owner_occupied` tinyint(1) DEFAULT 1,
  `parcel_id` varchar(255) DEFAULT NULL,
  `roof_size` decimal(10,2) DEFAULT NULL,
  `solar_potential` text DEFAULT NULL,
  `estimated_savings` decimal(10,2) DEFAULT NULL,
  `lead_score` int(11) DEFAULT NULL,
  `status` varchar(255) NOT NULL DEFAULT 'new',
  `created_at` datetime DEFAULT current_timestamp(),
  `notes` text DEFAULT NULL,
  `assigned_to` int(10) UNSIGNED DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `solar_json` longtext DEFAULT NULL,
  `property_json` longtext DEFAULT NULL,
  `image_url` varchar(1024) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `leads`
--

INSERT INTO `leads` (`id`, `user_id`, `address`, `latitude`, `longitude`, `owner_name`, `phone`, `phone_type`, `email`, `email_status`, `linkedin`, `mailing_address`, `property_value`, `owner_occupied`, `parcel_id`, `roof_size`, `solar_potential`, `estimated_savings`, `lead_score`, `status`, `created_at`, `notes`, `assigned_to`, `updated_at`, `solar_json`, `property_json`, `image_url`) VALUES
(14, 2, '13010 Sw 116th St, Miami, FL 33186', '25.66046300', '-80.40537900', 'Brent Charran', 'Not Available', 'Not Available', 'Not Available', 'Not Available', 'Not Available', '12911 Sw 117th St, Miami, FL 33186', '450000.00', 0, '30-5911-012-0760', '1902.00', 'Good', '47943.00', 66, 'new', '2026-07-17 13:22:10', NULL, NULL, '2026-07-31 15:21:44', NULL, NULL, NULL),
(15, 2, '12964 Sw 119th Ter, Miami, FL 33186', '25.65686800', '-80.40507900', 'PAUL E EHRMAN', 'Not Available', 'Not Available', 'Not Available', 'Not Available', 'Not Available', '12964 Sw 119th Ter, Miami, FL 33186', '134000.00', 1, '30-5911-022-1030', '2235.00', 'Excellent', '431438.00', 92, 'new', '2026-07-17 13:23:33', NULL, NULL, '2026-07-31 15:21:44', NULL, NULL, NULL),
(16, 2, '13021 Sw 116th St, Miami, FL 33186', '25.66073100', '-80.40583000', 'John Isaacs', '(305) 385-3830', 'LANDLINE', 'winterexplorer98@gmail.com', 'Deliverable', 'Not Available', '13021 Sw 116th St, Miami, FL 33186', '70500.00', 1, '30-5911-012-0230', '2214.00', 'Excellent', '308016.00', 92, 'new', '2026-07-17 13:25:54', NULL, NULL, '2026-07-31 15:21:44', NULL, NULL, NULL),
(17, 2, '7200 Preston Rd, Plano, TX 75024', '33.07566200', '-96.79427000', 'Brian Rose', '(512) 422-4797', 'MOBILE', 'brianr3773@msn.com', 'Undeliverable', 'Not Available', NULL, NULL, 1, NULL, NULL, NULL, NULL, 82, 'qualified', '2026-07-17 14:37:00', NULL, NULL, '2026-07-31 15:21:44', NULL, NULL, NULL),
(18, 2, '7200 Preston Rd, Plano, TX 75024', '33.07566200', '-96.79427000', 'Brian Rose', '(512) 422-4797', 'MOBILE', 'brianr3773@msn.com', 'Undeliverable', 'Not Available', NULL, NULL, 1, NULL, NULL, NULL, NULL, 82, 'qualified', '2026-07-17 14:37:00', NULL, NULL, '2026-07-31 15:21:44', NULL, NULL, NULL),
(19, 2, '6900 Preston Rd, Plano, TX 75024', '33.06845000', '-96.79371300', 'Joe Banuelos', '(714) 552-6985', 'MOBILE', 'rsjoeh@gmail.com', 'Deliverable', 'Not Available', NULL, NULL, 1, NULL, NULL, NULL, NULL, 82, 'qualified', '2026-07-17 14:37:04', NULL, NULL, '2026-07-31 15:21:44', NULL, NULL, NULL),
(20, 2, '6900 Preston Rd, Plano, TX 75024', '33.06845000', '-96.79371300', 'Joe Banuelos', '(714) 552-6985', 'MOBILE', 'rsjoeh@gmail.com', 'Deliverable', 'Not Available', NULL, NULL, 1, NULL, NULL, NULL, NULL, 82, 'qualified', '2026-07-17 14:37:04', NULL, NULL, '2026-07-31 15:21:44', NULL, NULL, NULL),
(21, 2, '6600 Preston Rd, Plano, TX 75024', '33.06295500', '-96.79512000', 'Denver Apartments Llc', '(303) 278-2120', 'LANDLINE', 'dcamden@cs.com', 'Risky', 'Not Available', NULL, NULL, 1, NULL, NULL, NULL, NULL, 82, 'qualified', '2026-07-17 14:37:09', NULL, NULL, '2026-07-31 15:21:44', NULL, NULL, NULL),
(22, 2, '6600 Preston Rd, Plano, TX 75024', '33.06295500', '-96.79512000', 'Denver Apartments Llc', '(303) 278-2120', 'LANDLINE', 'dcamden@cs.com', 'Risky', 'Not Available', NULL, NULL, 1, NULL, NULL, NULL, NULL, 82, 'qualified', '2026-07-17 14:37:09', NULL, NULL, '2026-07-31 15:21:44', NULL, NULL, NULL),
(23, 2, '507 N Alpine Dr, Beverly Hills, CA 90210', '34.07496600', '-118.40060700', 'DAVID SOGHOR', '(714) 717-5954', 'MOBILE', 'matthewsoghor@bellsouth.net', 'Risky', 'Not Available', '507 N Alpine Dr, Beverly Hills, CA 90210', '533542.00', 1, '4341-030-026', '3882.00', 'Excellent', '217463.00', 98, 'new', '2026-07-17 15:02:06', NULL, NULL, '2026-07-31 15:21:44', NULL, NULL, NULL),
(24, 3, '1455 Greenridge Dr, Beverly Hills, CA 90210', '34.09706200', '-118.41843000', 'MIRZAI Trustee', '(310) 559-6011', 'MOBILE', 'mirbh@yahoo.com', 'Deliverable', 'Not Available', '1433 Laurel Way, Beverly Hills, CA 90210', '3014053.00', 0, '4355-018-013', '3318.00', 'Excellent', '92920.00', 88, 'qualified', '2026-07-31 21:29:19', NULL, NULL, '2026-07-31 15:59:19', NULL, NULL, NULL),
(25, 3, '12007 Crest Ct, Beverly Hills, CA 90210', '34.12436100', '-118.39950500', 'Jacob Tauber', '(310) 413-0803', 'MOBILE', 'jetmd76@gmail.com', 'Deliverable', 'Not Available', '12007 Crest Ct, Beverly Hills, CA 90210', '1961016.00', 1, '2382-020-030', '5649.00', 'Excellent', '150984.00', 98, 'qualified', '2026-07-31 21:29:24', NULL, NULL, '2026-07-31 15:59:24', NULL, NULL, NULL),
(26, 3, '307 N Palm Dr, Beverly Hills, CA 90210', '34.07136000', '-118.39258300', 'SHAHEEDY,MOHAMAD Trustee', '(310) 487-5049', 'MOBILE', 'jalehshaheedy@aol.com', 'Deliverable', 'Not Available', '307 N Palm Dr, Beverly Hills, CA 90210', '1400000.00', 1, '4342022013', '3771.00', 'Excellent', '142484.00', 98, 'qualified', '2026-07-31 21:53:10', NULL, NULL, '2026-07-31 16:23:10', NULL, NULL, NULL),
(27, 5, '3438 E Le Marche Ave, Phoenix, AZ 85032', '33.63283400', '-112.00732900', 'Fritz Arlberg', '(602) 466-3626', 'MOBILE', 'tallfritz@hotmail.com', 'Deliverable', 'Not Available', '3438 E Le Marche Ave, Phoenix, AZ 85032', '1080.00', 0, '21435297', '3402.00', 'Excellent', '259277.00', 82, 'qualified', '2026-08-02 13:38:13', NULL, NULL, '2026-08-02 08:21:10', '{\"roofOutline\":\"Identified — 10 roof segments\",\"totalRoofArea\":\"3,402 sq ft\",\"usableRoofArea\":\"2,381 sq ft\",\"orientation\":\"North-Facing (360°)\",\"pitch\":\"19.0° primary pitch\",\"annualSunlight\":\"1700 peak-sun hrs/yr (NREL)\",\"shading\":\"Significant (79%)\",\"potential\":\"Excellent\",\"recommendedSize\":\"46.8 kW\",\"estimatedPanels\":117,\"annualProduction\":\"57,617 kWh (NREL PVWatts)\",\"twentyFiveYearSavings\":\"$2,59,277\",\"existingSolar\":\"No panels detected\",\"imageryDate\":\"9/27/2023\",\"imageryQuality\":\"HIGH\",\"buildingFootprint\":\"3,505 sq ft\",\"panelWattage\":\"400W each\",\"carbonOffset\":\"631 kg CO₂/MWh\",\"roofSegments\":10,\"nrelCapacityFactor\":\"14.1%\",\"nrelSolradAnnual\":\"4.66 kWh/m²/day\",\"productionSource\":\"NREL PVWatts v8\"}', '{\"ownerName\":\"Not Available\",\"ownerOccupied\":\"Not Available\",\"mailingAddress\":\"Property at 33.63283, -112.00733\",\"propertyValue\":\"Not Available\",\"taxAssessedValue\":\"Not Available\",\"parcelNumber\":\"APN-336328\",\"lastSaleDate\":\"Not Available\",\"lastSalePrice\":\"Not Available\",\"livingArea\":\"Not Available\",\"lotSize\":\"Not Available\",\"stories\":\"Not Available\",\"propertyType\":\"Not Available\",\"yearBuilt\":\"Not Available\",\"aiLeadScore\":{\"overall\":64,\"label\":\"Moderate Candidate\",\"summary\":\"Some solar potential exists, but roof, value, or contact signals are mixed.\",\"breakdown\":{\"solarSuitability\":95,\"roofSize\":100,\"sunlightExposure\":94,\"propertyValue\":0,\"ownerOccupied\":0,\"contactAvailability\":0}}}', 'https://maps.googleapis.com/maps/api/staticmap?center=33.632834%2C-112.007329&zoom=20&size=640x360&maptype=satellite&scale=2&key=AIzaSyCBA9AhtIYZrLTKUJQ0SSgoTAIXgK8cnmg'),
(28, 5, '3430 E Monte Cristo Ave, Phoenix, AZ 85032', '33.63219900', '-112.00774400', 'MILJAN NIKOLIC', '(602) 687-2213', 'MOBILE', 'miljankolic@usa-11.com', 'Undeliverable', 'Not Available', '3430 E Monte Cristo Ave, Phoenix, AZ 85032', '115000.00', 1, '214-35-207', '2938.00', 'Excellent', '112197.00', 92, 'qualified', '2026-08-02 13:38:19', NULL, NULL, '2026-08-02 17:43:42', '{\"roofOutline\":\"Identified — 10 roof segments\",\"totalRoofArea\":\"2,938 sq ft\",\"usableRoofArea\":\"2,057 sq ft\",\"orientation\":\"North-Facing (0°)\",\"pitch\":\"27.0° primary pitch\",\"annualSunlight\":\"1487 peak-sun hrs/yr (NREL)\",\"shading\":\"Significant (82%)\",\"potential\":\"Excellent\",\"recommendedSize\":\"35.2 kW\",\"estimatedPanels\":88,\"annualProduction\":\"37,524 kWh (NREL PVWatts)\",\"twentyFiveYearSavings\":\"$1,12,197\",\"existingSolar\":\"No panels detected\",\"imageryDate\":\"9/27/2023\",\"imageryQuality\":\"HIGH\",\"buildingFootprint\":\"3,255 sq ft\",\"panelWattage\":\"400W each\",\"carbonOffset\":\"631 kg CO₂/MWh\",\"roofSegments\":10,\"nrelCapacityFactor\":\"12.2%\",\"nrelSolradAnnual\":\"4.08 kWh/m²/day\",\"productionSource\":\"NREL PVWatts v8\",\"electricityRate\":\"$0.120/kWh\",\"utilityName\":\"Arizona Public Service Co\"}', '{\"ownerName\":\"Not Available\",\"ownerOccupied\":\"Not Available\",\"mailingAddress\":\"Property at 33.63220, -112.00774\",\"propertyValue\":\"Not Available\",\"taxAssessedValue\":\"Not Available\",\"parcelNumber\":\"APN-336321\",\"lastSaleDate\":\"Not Available\",\"lastSalePrice\":\"Not Available\",\"livingArea\":\"Not Available\",\"lotSize\":\"Not Available\",\"stories\":\"Not Available\",\"propertyType\":\"Not Available\",\"yearBuilt\":\"Not Available\",\"aiLeadScore\":{\"overall\":64,\"label\":\"Moderate Candidate\",\"summary\":\"Some solar potential exists, but roof, value, or contact signals are mixed.\",\"breakdown\":{\"solarSuitability\":95,\"roofSize\":98,\"sunlightExposure\":94,\"propertyValue\":0,\"ownerOccupied\":0,\"contactAvailability\":0}}}', 'https://maps.googleapis.com/maps/api/staticmap?center=33.632199%2C-112.007744&zoom=20&size=640x360&maptype=satellite&scale=2&key=AIzaSyCBA9AhtIYZrLTKUJQ0SSgoTAIXgK8cnmg'),
(29, 5, '3549 E Betty Elyse Ln, Phoenix, AZ 85032', '33.62749900', '-112.00498300', 'Allan J Rosenberger', '(352) 332-5031', 'MOBILE', 'al.rose@q.com', 'Risky', 'Not Available', '3549 E Betty Elyse Ln, Phoenix, AZ 85032', '60946.00', 1, '214-35-053', '3787.00', 'Excellent', '264731.00', 92, 'qualified', '2026-08-02 23:12:55', NULL, NULL, '2026-08-02 17:42:55', '{\"roofOutline\":\"Identified — 12 roof segments\",\"totalRoofArea\":\"3,787 sq ft\",\"usableRoofArea\":\"2,651 sq ft\",\"orientation\":\"North-Facing (1°)\",\"pitch\":\"18.6° primary pitch\",\"annualSunlight\":\"1708 peak-sun hrs/yr (NREL)\",\"shading\":\"Significant (79%)\",\"potential\":\"Excellent\",\"recommendedSize\":\"47.6 kW\",\"estimatedPanels\":119,\"annualProduction\":\"58,829 kWh (NREL PVWatts)\",\"twentyFiveYearSavings\":\"$2,64,731\",\"existingSolar\":\"No panels detected\",\"imageryDate\":\"9/27/2023\",\"imageryQuality\":\"HIGH\",\"buildingFootprint\":\"3,949 sq ft\",\"panelWattage\":\"400W each\",\"carbonOffset\":\"631 kg CO₂/MWh\",\"roofSegments\":12,\"nrelCapacityFactor\":\"14.1%\",\"nrelSolradAnnual\":\"4.68 kWh/m²/day\",\"productionSource\":\"NREL PVWatts v8\"}', '{\"ownerName\":\"Allan J Rosenberger\",\"ownerOccupied\":\"Yes\",\"mailingAddress\":\"3549 E Betty Elyse Ln, Phoenix, AZ 85032\",\"propertyValue\":\"$60,946\",\"taxAssessedValue\":\"$45,710\",\"parcelNumber\":\"214-35-053\",\"lastSaleDate\":\"Not Available\",\"lastSalePrice\":\"Not Available\",\"livingArea\":\"2224 sq ft\",\"lotSize\":\"16096 sq ft\",\"stories\":1,\"propertyType\":\"Single Family\",\"yearBuilt\":1979,\"aiLeadScore\":{\"overall\":92,\"label\":\"Excellent Candidate\",\"summary\":\"Strong solar suitability, roof potential, and owner/contact signals based on live enrichment.\",\"breakdown\":{\"solarSuitability\":95,\"roofSize\":100,\"sunlightExposure\":78,\"propertyValue\":65,\"ownerOccupied\":100,\"contactAvailability\":96}}}', 'https://maps.googleapis.com/maps/api/staticmap?center=33.627499%2C-112.004983&zoom=20&size=640x360&maptype=satellite&scale=2&key=AIzaSyCBA9AhtIYZrLTKUJQ0SSgoTAIXgK8cnmg'),
(30, 5, '3540 E Beck Ln, Phoenix, AZ 85032', '33.62712600', '-112.00535400', 'Ernest J Becklund', '(602) 989-3031', 'MOBILE', 'ebecklund@gmail.com', 'Deliverable', 'Not Available', '3540 E Beck Ln, Phoenix, AZ 85032', '73440.00', 1, '214-35-071A', '4402.00', 'Excellent', '322098.00', 92, 'qualified', '2026-08-02 23:13:01', NULL, NULL, '2026-08-02 17:43:01', '{\"roofOutline\":\"Identified — 10 roof segments\",\"totalRoofArea\":\"4,402 sq ft\",\"usableRoofArea\":\"3,081 sq ft\",\"orientation\":\"South-Facing (Optimal) (181°)\",\"pitch\":\"18.4° primary pitch\",\"annualSunlight\":\"2371 peak-sun hrs/yr (NREL)\",\"shading\":\"Significant (80%)\",\"potential\":\"Excellent\",\"recommendedSize\":\"61.6 kW\",\"estimatedPanels\":154,\"annualProduction\":\"1,07,725 kWh (NREL PVWatts)\",\"twentyFiveYearSavings\":\"$3,22,098\",\"existingSolar\":\"No panels detected\",\"imageryDate\":\"9/27/2023\",\"imageryQuality\":\"HIGH\",\"buildingFootprint\":\"4,635 sq ft\",\"panelWattage\":\"400W each\",\"carbonOffset\":\"631 kg CO₂/MWh\",\"roofSegments\":10,\"nrelCapacityFactor\":\"20.0%\",\"nrelSolradAnnual\":\"6.49 kWh/m²/day\",\"productionSource\":\"NREL PVWatts v8\",\"electricityRate\":\"$0.120/kWh\",\"utilityName\":\"Arizona Public Service Co\"}', '{\"ownerName\":\"Ernest J Becklund\",\"ownerOccupied\":\"Yes\",\"mailingAddress\":\"3540 E Beck Ln, Phoenix, AZ 85032\",\"propertyValue\":\"$73,440\",\"taxAssessedValue\":\"$55,080\",\"parcelNumber\":\"214-35-071A\",\"lastSaleDate\":\"Not Available\",\"lastSalePrice\":\"Not Available\",\"livingArea\":\"1702 sq ft\",\"lotSize\":\"20619 sq ft\",\"stories\":1,\"propertyType\":\"Single Family\",\"yearBuilt\":1981,\"aiLeadScore\":{\"overall\":92,\"label\":\"Excellent Candidate\",\"summary\":\"Strong solar suitability, roof potential, and owner/contact signals based on live enrichment.\",\"breakdown\":{\"solarSuitability\":95,\"roofSize\":100,\"sunlightExposure\":100,\"propertyValue\":65,\"ownerOccupied\":100,\"contactAvailability\":96}}}', 'https://maps.googleapis.com/maps/api/staticmap?center=33.627126%2C-112.005354&zoom=20&size=640x360&maptype=satellite&scale=2&key=AIzaSyCBA9AhtIYZrLTKUJQ0SSgoTAIXgK8cnmg'),
(31, 5, '3541 E Betty Elyse Ln, Phoenix, AZ 85032', '33.62748800', '-112.00533800', 'Michael Broek', '(515) 203-6674', 'MOBILE', 'mdbroek@hotmail.com', 'Deliverable', 'Not Available', '3541 E Betty Elyse Ln, Phoenix, AZ 85032', '320000.00', 1, '214-35-054B', '4006.00', 'Excellent', '447701.00', 92, 'qualified', '2026-08-02 23:13:06', NULL, NULL, '2026-08-02 17:43:06', '{\"roofOutline\":\"Identified — 13 roof segments\",\"totalRoofArea\":\"4,006 sq ft\",\"usableRoofArea\":\"2,804 sq ft\",\"orientation\":\"South-Facing (Optimal) (181°)\",\"pitch\":\"18.8° primary pitch\",\"annualSunlight\":\"2374 peak-sun hrs/yr (NREL)\",\"shading\":\"Significant (87%)\",\"potential\":\"Excellent\",\"recommendedSize\":\"56.8 kW\",\"estimatedPanels\":142,\"annualProduction\":\"99,489 kWh (NREL PVWatts)\",\"twentyFiveYearSavings\":\"$4,47,701\",\"existingSolar\":\"No panels detected\",\"imageryDate\":\"9/27/2023\",\"imageryQuality\":\"HIGH\",\"buildingFootprint\":\"4,074 sq ft\",\"panelWattage\":\"400W each\",\"carbonOffset\":\"631 kg CO₂/MWh\",\"roofSegments\":13,\"nrelCapacityFactor\":\"20.0%\",\"nrelSolradAnnual\":\"6.50 kWh/m²/day\",\"productionSource\":\"NREL PVWatts v8\"}', '{\"ownerName\":\"Michael Broek\",\"ownerOccupied\":\"Yes\",\"mailingAddress\":\"3541 E Betty Elyse Ln, Phoenix, AZ 85032\",\"propertyValue\":\"$320,000\",\"taxAssessedValue\":\"$68,370\",\"parcelNumber\":\"214-35-054B\",\"lastSaleDate\":\"21/6/2013\",\"lastSalePrice\":\"$320,000\",\"livingArea\":\"2256 sq ft\",\"lotSize\":\"15071 sq ft\",\"stories\":1,\"propertyType\":\"Single Family\",\"yearBuilt\":2013,\"aiLeadScore\":{\"overall\":92,\"label\":\"Excellent Candidate\",\"summary\":\"Strong solar suitability, roof potential, and owner/contact signals based on live enrichment.\",\"breakdown\":{\"solarSuitability\":95,\"roofSize\":100,\"sunlightExposure\":100,\"propertyValue\":65,\"ownerOccupied\":100,\"contactAvailability\":96}}}', 'https://maps.googleapis.com/maps/api/staticmap?center=33.627488%2C-112.005338&zoom=20&size=640x360&maptype=satellite&scale=2&key=AIzaSyCBA9AhtIYZrLTKUJQ0SSgoTAIXgK8cnmg'),
(32, 5, '3548 E Betty Elyse Ln, Phoenix, AZ 85032', '33.62800300', '-112.00498000', 'Charles Sullens', '(602) 524-3272', 'MOBILE', 'Not Available', 'Not Available', 'Not Available', '3548 E Betty Elyse Ln, Phoenix, AZ 85032', '0.00', 0, '21435052', '4274.00', 'Excellent', '311537.00', 72, 'qualified', '2026-08-02 23:13:10', 'Partial contact (source=tracerfy+apollo). Missing: email.', NULL, '2026-08-02 17:43:10', '{\"roofOutline\":\"Identified — 11 roof segments\",\"totalRoofArea\":\"4,274 sq ft\",\"usableRoofArea\":\"2,992 sq ft\",\"orientation\":\"South-Facing (Optimal) (181°)\",\"pitch\":\"19.3° primary pitch\",\"annualSunlight\":\"2050 hrs/yr\",\"shading\":\"Significant (87%)\",\"potential\":\"Excellent\",\"recommendedSize\":\"58.0 kW\",\"estimatedPanels\":145,\"annualProduction\":\"104,193 kWh\",\"twentyFiveYearSavings\":\"$3,11,537\",\"existingSolar\":\"No panels detected\",\"imageryDate\":\"9/27/2023\",\"imageryQuality\":\"HIGH\",\"buildingFootprint\":\"4,527 sq ft\",\"panelWattage\":\"400W each\",\"carbonOffset\":\"631 kg CO₂/MWh\",\"roofSegments\":11,\"electricityRate\":\"$0.120/kWh\",\"utilityName\":\"Arizona Public Service Co\",\"productionSource\":\"Google Solar + NREL utility rate\"}', '{\"ownerName\":\"Charles Sullens\",\"ownerOccupied\":\"No\",\"mailingAddress\":\"3548 E Betty Elyse Ln, Phoenix, AZ 85032\",\"propertyValue\":\"Not Available\",\"taxAssessedValue\":\"Not Available\",\"parcelNumber\":\"21435052\",\"lastSaleDate\":\"Not Available\",\"lastSalePrice\":\"Not Available\",\"livingArea\":\"2624 sq ft\",\"lotSize\":\"15609 sq ft\",\"stories\":1,\"propertyType\":\"Single Family\",\"yearBuilt\":1979,\"aiLeadScore\":{\"overall\":72,\"label\":\"Strong Candidate\",\"summary\":\"Good roof and sunlight profile with solid property indicators from live data sources.\",\"breakdown\":{\"solarSuitability\":95,\"roofSize\":100,\"sunlightExposure\":93,\"propertyValue\":0,\"ownerOccupied\":50,\"contactAvailability\":60}}}', 'https://maps.googleapis.com/maps/api/staticmap?center=33.628003%2C-112.00498&zoom=20&size=640x360&maptype=satellite&scale=2&key=AIzaSyCBA9AhtIYZrLTKUJQ0SSgoTAIXgK8cnmg'),
(33, 5, '15645 N 36th St, Phoenix, AZ 85032', '33.62960000', '-112.00435200', 'Jari Marjanen', '(907) 982-7116', 'MOBILE', 'jpmalaska@yahoo.com', 'Deliverable', 'Not Available', '15645 N 36th St, Phoenix, AZ 85032', '238000.00', 1, '214-34-033D', '4136.00', 'Excellent', '457412.00', 92, 'qualified', '2026-08-02 23:13:18', NULL, NULL, '2026-08-02 17:43:18', '{\"roofOutline\":\"Identified — 6 roof segments\",\"totalRoofArea\":\"4,136 sq ft\",\"usableRoofArea\":\"2,895 sq ft\",\"orientation\":\"West-Facing (266°)\",\"pitch\":\"18.2° primary pitch\",\"annualSunlight\":\"1917 hrs/yr\",\"shading\":\"Significant (84%)\",\"potential\":\"Excellent\",\"recommendedSize\":\"57.2 kW\",\"estimatedPanels\":143,\"annualProduction\":\"101,647 kWh\",\"twentyFiveYearSavings\":\"$457,412\",\"existingSolar\":\"No panels detected\",\"imageryDate\":\"9/27/2023\",\"imageryQuality\":\"HIGH\",\"buildingFootprint\":\"4,399 sq ft\",\"panelWattage\":\"400W each\",\"carbonOffset\":\"631 kg CO₂/MWh\",\"roofSegments\":6}', '{\"ownerName\":\"Jari Marjanen\",\"ownerOccupied\":\"Yes\",\"mailingAddress\":\"15645 N 36th St, Phoenix, AZ 85032\",\"propertyValue\":\"$238,000\",\"taxAssessedValue\":\"$39,630\",\"parcelNumber\":\"214-34-033D\",\"lastSaleDate\":\"15/6/2018\",\"lastSalePrice\":\"$238,000\",\"livingArea\":\"1969 sq ft\",\"lotSize\":\"23260 sq ft\",\"stories\":1,\"propertyType\":\"Single Family\",\"yearBuilt\":1957,\"aiLeadScore\":{\"overall\":92,\"label\":\"Excellent Candidate\",\"summary\":\"Strong solar suitability, roof potential, and owner/contact signals based on live enrichment.\",\"breakdown\":{\"solarSuitability\":95,\"roofSize\":100,\"sunlightExposure\":87,\"propertyValue\":65,\"ownerOccupied\":100,\"contactAvailability\":96}}}', 'https://maps.googleapis.com/maps/api/staticmap?center=33.6296%2C-112.004352&zoom=20&size=640x360&maptype=satellite&scale=2&key=AIzaSyCBA9AhtIYZrLTKUJQ0SSgoTAIXgK8cnmg'),
(34, 5, '3610 E Tierra Buena Ln, Phoenix, AZ 85032', '33.63019200', '-112.00406600', 'Neil Edward Geesey', '(602) 909-6619', 'MOBILE', 'neilg@toyomotors.com', 'Deliverable', 'Not Available', '15815 N 36th St, Phoenix, AZ 85032', '356000.00', 0, '214-34-032F', '1187.00', 'Excellent', '113805.00', 82, 'qualified', '2026-08-02 23:13:24', NULL, NULL, '2026-08-02 17:43:24', '{\"roofOutline\":\"Identified — 3 roof segments\",\"totalRoofArea\":\"1,187 sq ft\",\"usableRoofArea\":\"831 sq ft\",\"orientation\":\"West-Facing (272°)\",\"pitch\":\"18.3° primary pitch\",\"annualSunlight\":\"2049 peak-sun hrs/yr (NREL)\",\"shading\":\"Significant (84%)\",\"potential\":\"Excellent\",\"recommendedSize\":\"16.8 kW\",\"estimatedPanels\":42,\"annualProduction\":\"25,290 kWh (NREL PVWatts)\",\"twentyFiveYearSavings\":\"$1,13,805\",\"existingSolar\":\"No panels detected\",\"imageryDate\":\"9/27/2023\",\"imageryQuality\":\"HIGH\",\"buildingFootprint\":\"1,304 sq ft\",\"panelWattage\":\"400W each\",\"carbonOffset\":\"631 kg CO₂/MWh\",\"roofSegments\":3,\"nrelCapacityFactor\":\"17.2%\",\"nrelSolradAnnual\":\"5.61 kWh/m²/day\",\"productionSource\":\"NREL PVWatts v8\"}', '{\"ownerName\":\"Neil Edward Geesey\",\"ownerOccupied\":\"No\",\"mailingAddress\":\"15815 N 36th St, Phoenix, AZ 85032\",\"propertyValue\":\"$356,000\",\"taxAssessedValue\":\"$55,150\",\"parcelNumber\":\"214-34-032F\",\"lastSaleDate\":\"25/8/2014\",\"lastSalePrice\":\"$356,000\",\"livingArea\":\"2689 sq ft\",\"lotSize\":\"42105 sq ft\",\"stories\":1,\"propertyType\":\"Single Family\",\"yearBuilt\":1978,\"aiLeadScore\":{\"overall\":82,\"label\":\"Strong Candidate\",\"summary\":\"Good roof and sunlight profile with solid property indicators from live data sources.\",\"breakdown\":{\"solarSuitability\":95,\"roofSize\":40,\"sunlightExposure\":93,\"propertyValue\":80,\"ownerOccupied\":50,\"contactAvailability\":96}}}', 'https://maps.googleapis.com/maps/api/staticmap?center=33.630192%2C-112.004066&zoom=20&size=640x360&maptype=satellite&scale=2&key=AIzaSyCBA9AhtIYZrLTKUJQ0SSgoTAIXgK8cnmg'),
(35, 5, '550 N Orange Grove Blvd, Pasadena, CA 91103', '34.15234000', '-118.15824800', 'RONALD WAYNE SHARP', '(717) 495-6693', 'MOBILE', 'kransom@ycp.edu', 'Risky', 'Not Available', '2636 Loma Vista Dr, Escondido, CA 92025', '440000.00', 0, '5711-016-070', '6182.00', 'Excellent', '338517.00', 82, 'qualified', '2026-08-03 10:07:00', NULL, NULL, '2026-08-03 04:37:00', '{\"roofOutline\":\"Identified — 20 roof segments\",\"totalRoofArea\":\"6,182 sq ft\",\"usableRoofArea\":\"4,327 sq ft\",\"orientation\":\"Southwest-Facing (208°)\",\"pitch\":\"1.2° primary pitch\",\"annualSunlight\":\"1759 hrs/yr\",\"shading\":\"Significant (86%)\",\"potential\":\"Excellent\",\"recommendedSize\":\"59.6 kW\",\"estimatedPanels\":149,\"annualProduction\":\"88,098 kWh\",\"twentyFiveYearSavings\":\"$3,38,517\",\"existingSolar\":\"No panels detected\",\"imageryDate\":\"8/25/2024\",\"imageryQuality\":\"HIGH\",\"buildingFootprint\":\"7,258 sq ft\",\"panelWattage\":\"400W each\",\"carbonOffset\":\"429 kg CO₂/MWh\",\"roofSegments\":20,\"electricityRate\":\"$0.154/kWh\",\"utilityName\":\"Pasadena Water & Power Dept\",\"productionSource\":\"Google Solar + NREL utility rate\"}', '{\"ownerName\":\"RONALD WAYNE SHARP\",\"ownerOccupied\":\"No\",\"mailingAddress\":\"2636 Loma Vista Dr, Escondido, CA 92025\",\"propertyValue\":\"$440,000\",\"taxAssessedValue\":\"$539,369\",\"parcelNumber\":\"5711-016-070\",\"lastSaleDate\":\"23/5/2014\",\"lastSalePrice\":\"$440,000\",\"livingArea\":\"1037 sq ft\",\"lotSize\":\"167427 sq ft\",\"stories\":\"Not Available\",\"propertyType\":\"Single Family\",\"yearBuilt\":1977,\"aiLeadScore\":{\"overall\":82,\"label\":\"Strong Candidate\",\"summary\":\"Good roof and sunlight profile with solid property indicators from live data sources.\",\"breakdown\":{\"solarSuitability\":95,\"roofSize\":100,\"sunlightExposure\":80,\"propertyValue\":80,\"ownerOccupied\":50,\"contactAvailability\":96}}}', 'https://maps.googleapis.com/maps/api/staticmap?center=34.15234%2C-118.158248&zoom=20&size=640x360&maptype=satellite&scale=2&key=AIzaSyCBA9AhtIYZrLTKUJQ0SSgoTAIXgK8cnmg'),
(36, 5, '468 Rosemont Ave, Pasadena, CA 91103', '34.15234000', '-118.15824800', 'Curt Anthony Chase', '(818) 618-1575', 'MOBILE', 'chase3727@charter.net', 'Deliverable', 'Not Available', '468 Rosemont Ave, Pasadena, CA 91103', '615000.00', 1, '5711016040', '6182.00', 'Excellent', '338517.00', 98, 'qualified', '2026-08-03 10:07:06', NULL, NULL, '2026-08-03 04:37:06', '{\"roofOutline\":\"Identified — 20 roof segments\",\"totalRoofArea\":\"6,182 sq ft\",\"usableRoofArea\":\"4,327 sq ft\",\"orientation\":\"Southwest-Facing (208°)\",\"pitch\":\"1.2° primary pitch\",\"annualSunlight\":\"1759 hrs/yr\",\"shading\":\"Significant (86%)\",\"potential\":\"Excellent\",\"recommendedSize\":\"59.6 kW\",\"estimatedPanels\":149,\"annualProduction\":\"88,098 kWh\",\"twentyFiveYearSavings\":\"$3,38,517\",\"existingSolar\":\"No panels detected\",\"imageryDate\":\"8/25/2024\",\"imageryQuality\":\"HIGH\",\"buildingFootprint\":\"7,258 sq ft\",\"panelWattage\":\"400W each\",\"carbonOffset\":\"429 kg CO₂/MWh\",\"roofSegments\":20,\"electricityRate\":\"$0.154/kWh\",\"utilityName\":\"Pasadena Water & Power Dept\",\"productionSource\":\"Google Solar + NREL utility rate\"}', '{\"ownerName\":\"Curt Anthony Chase\",\"ownerOccupied\":\"Yes\",\"mailingAddress\":\"468 Rosemont Ave, Pasadena, CA 91103\",\"propertyValue\":\"$615,000\",\"taxAssessedValue\":\"$665,693\",\"parcelNumber\":\"5711016040\",\"lastSaleDate\":\"14/8/2020\",\"lastSalePrice\":\"$615,000\",\"livingArea\":\"961 sq ft\",\"lotSize\":\"3154 sq ft\",\"stories\":\"Not Available\",\"propertyType\":\"Single Family\",\"yearBuilt\":1977,\"aiLeadScore\":{\"overall\":98,\"label\":\"Excellent Candidate\",\"summary\":\"Strong solar suitability, roof potential, and owner/contact signals based on live enrichment.\",\"breakdown\":{\"solarSuitability\":95,\"roofSize\":100,\"sunlightExposure\":80,\"propertyValue\":95,\"ownerOccupied\":100,\"contactAvailability\":96}}}', 'https://maps.googleapis.com/maps/api/staticmap?center=34.15234%2C-118.158248&zoom=20&size=640x360&maptype=satellite&scale=2&key=AIzaSyCBA9AhtIYZrLTKUJQ0SSgoTAIXgK8cnmg'),
(37, 5, '524 N Orange Grove Blvd, Pasadena, CA 91103', '34.15234000', '-118.15824800', 'Sean Dylan Martin', '(310) 902-8685', 'MOBILE', 'ivyantiochmartin@gmail.com', 'Deliverable', 'Not Available', '362 Palos Verdes Blvd, APT 1, Redondo Beach, CA 90277', '785000.00', 0, '5711016074', '6182.00', 'Excellent', '338517.00', 88, 'new', '2026-08-03 10:07:11', NULL, NULL, '2026-08-07 03:55:39', '{\"roofOutline\":\"Identified — 20 roof segments\",\"totalRoofArea\":\"6,182 sq ft\",\"usableRoofArea\":\"4,327 sq ft\",\"orientation\":\"Southwest-Facing (208°)\",\"pitch\":\"1.2° primary pitch\",\"annualSunlight\":\"1759 hrs/yr\",\"shading\":\"Significant (86%)\",\"potential\":\"Excellent\",\"recommendedSize\":\"59.6 kW\",\"estimatedPanels\":149,\"annualProduction\":\"88,098 kWh\",\"twentyFiveYearSavings\":\"$3,38,517\",\"existingSolar\":\"No panels detected\",\"imageryDate\":\"8/25/2024\",\"imageryQuality\":\"HIGH\",\"buildingFootprint\":\"7,258 sq ft\",\"panelWattage\":\"400W each\",\"carbonOffset\":\"429 kg CO₂/MWh\",\"roofSegments\":20,\"electricityRate\":\"$0.154/kWh\",\"utilityName\":\"Pasadena Water & Power Dept\",\"productionSource\":\"Google Solar + NREL utility rate\"}', '{\"ownerName\":\"Sean Dylan Martin\",\"ownerOccupied\":\"No\",\"mailingAddress\":\"362 Palos Verdes Blvd, APT 1, Redondo Beach, CA 90277\",\"propertyValue\":\"$785,000\",\"taxAssessedValue\":\"$833,046\",\"parcelNumber\":\"5711016074\",\"lastSaleDate\":\"2/5/2022\",\"lastSalePrice\":\"$785,000\",\"livingArea\":\"961 sq ft\",\"lotSize\":\"3154 sq ft\",\"stories\":\"Not Available\",\"propertyType\":\"Single Family\",\"yearBuilt\":1977,\"aiLeadScore\":{\"overall\":88,\"label\":\"Excellent Candidate\",\"summary\":\"Strong solar suitability, roof potential, and owner/contact signals based on live enrichment.\",\"breakdown\":{\"solarSuitability\":95,\"roofSize\":100,\"sunlightExposure\":80,\"propertyValue\":95,\"ownerOccupied\":50,\"contactAvailability\":96}}}', 'https://maps.googleapis.com/maps/api/staticmap?center=34.15234%2C-118.158248&zoom=20&size=640x360&maptype=satellite&scale=2&key=AIzaSyCBA9AhtIYZrLTKUJQ0SSgoTAIXgK8cnmg'),
(38, 5, '517 Cypress Ave, Pasadena, CA 91103', '34.15366000', '-118.15510800', 'Michael J Espinoza', '(626) 673-7428', 'MOBILE', 'mikex1604@hotmail.com', 'Deliverable', 'Not Available', '517 Cypress Ave, Pasadena, CA 91103', '1098010.00', 1, '5726-012-040', '3113.00', 'Excellent', '111537.00', 98, 'new', '2026-08-03 10:07:16', NULL, NULL, '2026-08-07 03:55:37', '{\"roofOutline\":\"Identified — 18 roof segments\",\"totalRoofArea\":\"3,113 sq ft\",\"usableRoofArea\":\"2,179 sq ft\",\"orientation\":\"Northwest-Facing (325°)\",\"pitch\":\"31.7° primary pitch\",\"annualSunlight\":\"1390 peak-sun hrs/yr (NREL)\",\"shading\":\"Significant (78%)\",\"potential\":\"Excellent\",\"recommendedSize\":\"24.0 kW\",\"estimatedPanels\":60,\"annualProduction\":\"24,786 kWh (NREL PVWatts)\",\"twentyFiveYearSavings\":\"$1,11,537\",\"existingSolar\":\"No panels detected\",\"imageryDate\":\"8/25/2024\",\"imageryQuality\":\"HIGH\",\"buildingFootprint\":\"3,383 sq ft\",\"panelWattage\":\"400W each\",\"carbonOffset\":\"429 kg CO₂/MWh\",\"roofSegments\":18,\"nrelCapacityFactor\":\"11.8%\",\"nrelSolradAnnual\":\"3.81 kWh/m²/day\",\"productionSource\":\"NREL PVWatts v8\"}', '{\"ownerName\":\"Michael J Espinoza\",\"ownerOccupied\":\"Yes\",\"mailingAddress\":\"517 Cypress Ave, Pasadena, CA 91103\",\"propertyValue\":\"$1,098,010\",\"taxAssessedValue\":\"$1,142,359\",\"parcelNumber\":\"5726-012-040\",\"lastSaleDate\":\"18/8/2022\",\"lastSalePrice\":\"$1,098,010\",\"livingArea\":\"1424 sq ft\",\"lotSize\":\"6359 sq ft\",\"stories\":1,\"propertyType\":\"Single Family\",\"yearBuilt\":1901,\"aiLeadScore\":{\"overall\":98,\"label\":\"Excellent Candidate\",\"summary\":\"Strong solar suitability, roof potential, and owner/contact signals based on live enrichment.\",\"breakdown\":{\"solarSuitability\":95,\"roofSize\":100,\"sunlightExposure\":63,\"propertyValue\":95,\"ownerOccupied\":100,\"contactAvailability\":96}}}', 'https://maps.googleapis.com/maps/api/staticmap?center=34.15366%2C-118.155108&zoom=20&size=640x360&maptype=satellite&scale=2&key=AIzaSyCBA9AhtIYZrLTKUJQ0SSgoTAIXgK8cnmg'),
(39, 5, '515 Cypress Ave, Pasadena, CA 91103', '34.15353800', '-118.15533100', 'VIKRAM SINGH RAVINDER', '(626) 628-4660', 'MOBILE', 'vikram.s.ravinder@gmail.com', 'Deliverable', 'Not Available', '2845 Lavender Dr, Walnut Creek, CA 94596', '529500.00', 0, '5726-012-039', '1018.00', 'Good', '31874.00', 74, 'new', '2026-08-03 10:07:20', 'dd', NULL, '2026-08-07 08:22:32', '{\"roofOutline\":\"Identified — 7 roof segments\",\"totalRoofArea\":\"1,018 sq ft\",\"usableRoofArea\":\"713 sq ft\",\"orientation\":\"Northwest-Facing (334°)\",\"pitch\":\"13.1° primary pitch\",\"annualSunlight\":\"1726 peak-sun hrs/yr (NREL)\",\"shading\":\"Significant (80%)\",\"potential\":\"Good\",\"recommendedSize\":\"6.4 kW\",\"estimatedPanels\":16,\"annualProduction\":\"8,295 kWh (NREL PVWatts)\",\"twentyFiveYearSavings\":\"$31,874\",\"existingSolar\":\"No panels detected\",\"imageryDate\":\"8/25/2024\",\"imageryQuality\":\"HIGH\",\"buildingFootprint\":\"1,197 sq ft\",\"panelWattage\":\"400W each\",\"carbonOffset\":\"429 kg CO₂/MWh\",\"roofSegments\":7,\"nrelCapacityFactor\":\"14.8%\",\"nrelSolradAnnual\":\"4.73 kWh/m²/day\",\"productionSource\":\"NREL PVWatts v8\",\"electricityRate\":\"$0.154/kWh\",\"utilityName\":\"Pasadena Water & Power Dept\"}', '{\"ownerName\":\"VIKRAM SINGH RAVINDER\",\"ownerOccupied\":\"No\",\"mailingAddress\":\"2845 Lavender Dr, Walnut Creek, CA 94596\",\"propertyValue\":\"$529,500\",\"taxAssessedValue\":\"$707,565\",\"parcelNumber\":\"5726-012-039\",\"lastSaleDate\":\"7/12/2020\",\"lastSalePrice\":\"$529,500\",\"livingArea\":\"1130 sq ft\",\"lotSize\":\"3944 sq ft\",\"stories\":1,\"propertyType\":\"Single Family\",\"yearBuilt\":1911,\"aiLeadScore\":{\"overall\":74,\"label\":\"Strong Candidate\",\"summary\":\"Good roof and sunlight profile with solid property indicators from live data sources.\",\"breakdown\":{\"solarSuitability\":76,\"roofSize\":34,\"sunlightExposure\":78,\"propertyValue\":80,\"ownerOccupied\":50,\"contactAvailability\":96}}}', 'https://maps.googleapis.com/maps/api/staticmap?center=34.153538%2C-118.155331&zoom=20&size=640x360&maptype=satellite&scale=2&key=AIzaSyCBA9AhtIYZrLTKUJQ0SSgoTAIXgK8cnmg'),
(40, 6, '2736 Sw 7th Ave, Miami, FL 33129', '25.75819700', '-80.21287600', 'EDUARDO EUGENIO UTSET', '(305) 299-3566', 'MOBILE', 'utset@hotmail.com', 'Deliverable', 'Not Available', '2736 Sw 7th Ave, Miami, FL 33129', '240000.00', 1, '01-4138-008-2410', '3420.00', 'Excellent', '274203.00', 92, 'qualified', '2026-08-06 13:56:27', NULL, NULL, '2026-08-06 08:26:27', '{\"roofOutline\":\"Identified — 8 roof segments\",\"totalRoofArea\":\"3,420 sq ft\",\"usableRoofArea\":\"2,394 sq ft\",\"orientation\":\"Northwest-Facing (322°)\",\"pitch\":\"15.1° primary pitch\",\"annualSunlight\":\"1688 hrs/yr\",\"shading\":\"Significant (78%)\",\"potential\":\"Excellent\",\"recommendedSize\":\"40.0 kW\",\"estimatedPanels\":100,\"annualProduction\":\"60,934 kWh\",\"twentyFiveYearSavings\":\"$274,203\",\"existingSolar\":\"No panels detected\",\"imageryDate\":\"2/27/2021\",\"imageryQuality\":\"HIGH\",\"buildingFootprint\":\"3,500 sq ft\",\"panelWattage\":\"400W each\",\"carbonOffset\":\"541 kg CO₂/MWh\",\"roofSegments\":8}', '{\"ownerName\":\"EDUARDO EUGENIO UTSET\",\"ownerOccupied\":\"Yes\",\"mailingAddress\":\"2736 Sw 7th Ave, Miami, FL 33129\",\"propertyValue\":\"$240,000\",\"taxAssessedValue\":\"$347,029\",\"parcelNumber\":\"01-4138-008-2410\",\"lastSaleDate\":\"28/2/2000\",\"lastSalePrice\":\"$240,000\",\"livingArea\":\"3056 sq ft\",\"lotSize\":\"7500 sq ft\",\"stories\":1,\"propertyType\":\"Single Family\",\"yearBuilt\":1937,\"aiLeadScore\":{\"overall\":92,\"label\":\"Excellent Candidate\",\"summary\":\"Strong solar suitability, roof potential, and owner/contact signals based on live enrichment.\",\"breakdown\":{\"solarSuitability\":95,\"roofSize\":100,\"sunlightExposure\":77,\"propertyValue\":65,\"ownerOccupied\":100,\"contactAvailability\":96}}}', 'https://maps.googleapis.com/maps/api/staticmap?center=25.758197%2C-80.212876&zoom=20&size=640x360&maptype=satellite&scale=2&key=AIzaSyCBA9AhtIYZrLTKUJQ0SSgoTAIXgK8cnmg'),
(41, 6, '2711 Sw 7th Ave, Miami, FL 33129', '25.75804300', '-80.21235200', 'LORENZO DEL MORAL', '(305) 322-7314', 'MOBILE', 'arensondelmoral@bellsouth.net', 'Risky', 'Not Available', '2711 Sw 7th Ave, Miami, FL 33129', '180000.00', 1, '01-4138-008-2330', '2292.00', 'Excellent', '135347.00', 92, 'qualified', '2026-08-06 13:56:32', NULL, NULL, '2026-08-06 08:26:32', '{\"roofOutline\":\"Identified — 12 roof segments\",\"totalRoofArea\":\"2,292 sq ft\",\"usableRoofArea\":\"1,604 sq ft\",\"orientation\":\"South-Facing (Optimal) (167°)\",\"pitch\":\"3.3° primary pitch\",\"annualSunlight\":\"1620 hrs/yr\",\"shading\":\"Significant (77%)\",\"potential\":\"Excellent\",\"recommendedSize\":\"21.2 kW\",\"estimatedPanels\":53,\"annualProduction\":\"30,077 kWh\",\"twentyFiveYearSavings\":\"$135,347\",\"existingSolar\":\"No panels detected\",\"imageryDate\":\"2/27/2021\",\"imageryQuality\":\"HIGH\",\"buildingFootprint\":\"2,393 sq ft\",\"panelWattage\":\"400W each\",\"carbonOffset\":\"541 kg CO₂/MWh\",\"roofSegments\":12}', '{\"ownerName\":\"LORENZO DEL MORAL\",\"ownerOccupied\":\"Yes\",\"mailingAddress\":\"2711 Sw 7th Ave, Miami, FL 33129\",\"propertyValue\":\"$180,000\",\"taxAssessedValue\":\"$256,292\",\"parcelNumber\":\"01-4138-008-2330\",\"lastSaleDate\":\"5/2/1999\",\"lastSalePrice\":\"$180,000\",\"livingArea\":\"1825 sq ft\",\"lotSize\":\"6500 sq ft\",\"stories\":1,\"propertyType\":\"Single Family\",\"yearBuilt\":1939,\"aiLeadScore\":{\"overall\":92,\"label\":\"Excellent Candidate\",\"summary\":\"Strong solar suitability, roof potential, and owner/contact signals based on live enrichment.\",\"breakdown\":{\"solarSuitability\":95,\"roofSize\":76,\"sunlightExposure\":74,\"propertyValue\":65,\"ownerOccupied\":100,\"contactAvailability\":96}}}', 'https://maps.googleapis.com/maps/api/staticmap?center=25.758043%2C-80.212352&zoom=20&size=640x360&maptype=satellite&scale=2&key=AIzaSyCBA9AhtIYZrLTKUJQ0SSgoTAIXgK8cnmg'),
(42, 6, '610 Sw 27th Rd, Miami, FL 33129', '25.75784200', '-80.21201100', 'YENISIS GOMEZ', '(305) 793-7979', 'MOBILE', 'yenisis.lopez@yahoo.com', 'Risky', 'Not Available', '610 Sw 27th Rd, Miami, FL 33129', '261904.00', 1, '01-4138-008-2310', '1703.00', 'Excellent', '152793.00', 92, 'qualified', '2026-08-06 13:56:44', NULL, NULL, '2026-08-06 08:26:44', '{\"roofOutline\":\"Identified — 4 roof segments\",\"totalRoofArea\":\"1,703 sq ft\",\"usableRoofArea\":\"1,192 sq ft\",\"orientation\":\"Northeast-Facing (52°)\",\"pitch\":\"15.0° primary pitch\",\"annualSunlight\":\"1743 hrs/yr\",\"shading\":\"Significant (71%)\",\"potential\":\"Excellent\",\"recommendedSize\":\"20.4 kW\",\"estimatedPanels\":51,\"annualProduction\":\"33,954 kWh\",\"twentyFiveYearSavings\":\"$152,793\",\"existingSolar\":\"No panels detected\",\"imageryDate\":\"2/27/2021\",\"imageryQuality\":\"HIGH\",\"buildingFootprint\":\"1,875 sq ft\",\"panelWattage\":\"400W each\",\"carbonOffset\":\"541 kg CO₂/MWh\",\"roofSegments\":4}', '{\"ownerName\":\"YENISIS GOMEZ\",\"ownerOccupied\":\"Yes\",\"mailingAddress\":\"610 Sw 27th Rd, Miami, FL 33129\",\"propertyValue\":\"$261,904\",\"taxAssessedValue\":\"$196,428\",\"parcelNumber\":\"01-4138-008-2310\",\"lastSaleDate\":\"Not Available\",\"lastSalePrice\":\"Not Available\",\"livingArea\":\"1331 sq ft\",\"lotSize\":\"7450 sq ft\",\"stories\":1,\"propertyType\":\"Single Family\",\"yearBuilt\":1938,\"aiLeadScore\":{\"overall\":92,\"label\":\"Excellent Candidate\",\"summary\":\"Strong solar suitability, roof potential, and owner/contact signals based on live enrichment.\",\"breakdown\":{\"solarSuitability\":95,\"roofSize\":57,\"sunlightExposure\":79,\"propertyValue\":65,\"ownerOccupied\":100,\"contactAvailability\":96}}}', 'https://maps.googleapis.com/maps/api/staticmap?center=25.757842%2C-80.212011&zoom=20&size=640x360&maptype=satellite&scale=2&key=AIzaSyCBA9AhtIYZrLTKUJQ0SSgoTAIXgK8cnmg'),
(43, 6, '630 Sw 27th Rd, Miami, FL 33129', '25.75816700', '-80.21215500', 'ALBERTO R PEREZ', '(305) 336-4324', 'MOBILE', 'darianfumero@yahoo.com', 'Risky', 'Not Available', '5230 Alhambra Cir, Coral Gables, FL 33146', '1366858.00', 0, '01-4138-008-2340', '1996.00', 'Excellent', '138362.00', 88, 'qualified', '2026-08-06 13:56:53', NULL, NULL, '2026-08-06 08:26:53', '{\"roofOutline\":\"Identified — 8 roof segments\",\"totalRoofArea\":\"1,996 sq ft\",\"usableRoofArea\":\"1,397 sq ft\",\"orientation\":\"Northwest-Facing (321°)\",\"pitch\":\"13.4° primary pitch\",\"annualSunlight\":\"1684 hrs/yr\",\"shading\":\"Significant (81%)\",\"potential\":\"Excellent\",\"recommendedSize\":\"20.4 kW\",\"estimatedPanels\":51,\"annualProduction\":\"30,747 kWh\",\"twentyFiveYearSavings\":\"$138,362\",\"existingSolar\":\"No panels detected\",\"imageryDate\":\"2/27/2021\",\"imageryQuality\":\"HIGH\",\"buildingFootprint\":\"2,248 sq ft\",\"panelWattage\":\"400W each\",\"carbonOffset\":\"541 kg CO₂/MWh\",\"roofSegments\":8}', '{\"ownerName\":\"ALBERTO R PEREZ\",\"ownerOccupied\":\"No\",\"mailingAddress\":\"5230 Alhambra Cir, Coral Gables, FL 33146\",\"propertyValue\":\"$1,366,858\",\"taxAssessedValue\":\"$1,025,144\",\"parcelNumber\":\"01-4138-008-2340\",\"lastSaleDate\":\"Not Available\",\"lastSalePrice\":\"Not Available\",\"livingArea\":\"1530 sq ft\",\"lotSize\":\"8350 sq ft\",\"stories\":1,\"propertyType\":\"Single Family\",\"yearBuilt\":1939,\"aiLeadScore\":{\"overall\":88,\"label\":\"Excellent Candidate\",\"summary\":\"Strong solar suitability, roof potential, and owner/contact signals based on live enrichment.\",\"breakdown\":{\"solarSuitability\":95,\"roofSize\":67,\"sunlightExposure\":77,\"propertyValue\":95,\"ownerOccupied\":50,\"contactAvailability\":96}}}', 'https://maps.googleapis.com/maps/api/staticmap?center=25.758167%2C-80.212155&zoom=20&size=640x360&maptype=satellite&scale=2&key=AIzaSyCBA9AhtIYZrLTKUJQ0SSgoTAIXgK8cnmg'),
(44, 6, '620 Sw 27th Rd, Miami, FL 33129', '25.75796220', '-80.21206590', 'Catalina Acevedo', '(305) 274-5577', 'LANDLINE', 'pschuck5@yahoo.com', 'Risky', 'Not Available', '620 Sw 27th Rd, Miami, FL 33129', '1000000.00', 1, '01-4138-008-2320', '2554.00', 'Excellent', '245713.00', 98, 'qualified', '2026-08-06 13:57:03', NULL, NULL, '2026-08-07 08:39:06', '{\"roofOutline\":\"Identified — 5 roof segments\",\"totalRoofArea\":\"2,554 sq ft\",\"usableRoofArea\":\"1,788 sq ft\",\"orientation\":\"Southwest-Facing (233°)\",\"pitch\":\"15.1° primary pitch\",\"annualSunlight\":\"1746 hrs/yr\",\"shading\":\"Significant (76%)\",\"potential\":\"Excellent\",\"recommendedSize\":\"32.8 kW\",\"estimatedPanels\":82,\"annualProduction\":\"54,603 kWh\",\"twentyFiveYearSavings\":\"$245,713\",\"existingSolar\":\"No panels detected\",\"imageryDate\":\"2/27/2021\",\"imageryQuality\":\"HIGH\",\"buildingFootprint\":\"2,606 sq ft\",\"panelWattage\":\"400W each\",\"carbonOffset\":\"541 kg CO₂/MWh\",\"roofSegments\":5}', '{\"ownerName\":\"Catalina Acevedo\",\"ownerOccupied\":\"Yes\",\"mailingAddress\":\"620 Sw 27th Rd, Miami, FL 33129\",\"propertyValue\":\"$1,000,000\",\"taxAssessedValue\":\"$960,682\",\"parcelNumber\":\"01-4138-008-2320\",\"lastSaleDate\":\"10/6/2022\",\"lastSalePrice\":\"$1,000,000\",\"livingArea\":\"1257 sq ft\",\"lotSize\":\"7450 sq ft\",\"stories\":1,\"propertyType\":\"Single Family\",\"yearBuilt\":1939,\"aiLeadScore\":{\"overall\":98,\"label\":\"Excellent Candidate\",\"summary\":\"Strong solar suitability, roof potential, and owner/contact signals based on live enrichment.\",\"breakdown\":{\"solarSuitability\":95,\"roofSize\":85,\"sunlightExposure\":79,\"propertyValue\":95,\"ownerOccupied\":100,\"contactAvailability\":96}}}', 'https://maps.googleapis.com/maps/api/staticmap?center=25.75813%2C-80.211894&zoom=20&size=640x360&maptype=satellite&scale=2&key=AIzaSyCBA9AhtIYZrLTKUJQ0SSgoTAIXgK8cnmg'),
(46, 1, '123 Solar Test Way, Beverly Hills, CA 90210', NULL, NULL, 'Personal Test Lead', '+919876543210', NULL, NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL, NULL, '28500.00', NULL, 'test', '2026-08-07 10:18:28', NULL, NULL, '2026-08-07 04:48:28', NULL, NULL, NULL),
(69, 5, '604 N Crescent Dr, Beverly Hills, CA 90210', '34.07657910', '-118.40412780', 'HAZEM HADDAD', '(714) 580-0670', 'MOBILE', 'hazemh@hotmail.com', 'Deliverable', 'Not Available', '128 Kings Pl, Newport Beach, CA 92663', '7600076.00', 0, '4344-004-002', '2156.00', 'Excellent', '150831.00', 88, 'new', '2026-08-07 14:41:27', NULL, NULL, '2026-08-07 09:11:27', '{\"roofOutline\":\"Identified — 9 roof segments\",\"totalRoofArea\":\"2,156 sq ft\",\"usableRoofArea\":\"1,509 sq ft\",\"orientation\":\"North-Facing (0°)\",\"pitch\":\"0.2° primary pitch\",\"annualSunlight\":\"1695 hrs/yr\",\"shading\":\"Significant (85%)\",\"potential\":\"Excellent\",\"recommendedSize\":\"22.8 kW\",\"estimatedPanels\":57,\"annualProduction\":\"33,518 kWh\",\"twentyFiveYearSavings\":\"$150,831\",\"existingSolar\":\"No panels detected\",\"imageryDate\":\"4/18/2018\",\"imageryQuality\":\"HIGH\",\"buildingFootprint\":\"2,585 sq ft\",\"panelWattage\":\"400W each\",\"carbonOffset\":\"429 kg CO₂/MWh\",\"roofSegments\":9}', '{\"ownerName\":\"HAZEM HADDAD\",\"ownerOccupied\":\"No\",\"mailingAddress\":\"128 Kings Pl, Newport Beach, CA 92663\",\"propertyValue\":\"$7,600,076\",\"taxAssessedValue\":\"$8,065,180\",\"parcelNumber\":\"4344-004-002\",\"lastSaleDate\":\"4/13/2021\",\"lastSalePrice\":\"$7,600,076\",\"latitude\":34.0765791,\"longitude\":-118.40412780000001,\"livingArea\":\"4731 sq ft\",\"lotSize\":\"13877 sq ft\",\"stories\":2,\"propertyType\":\"Single Family\",\"yearBuilt\":1921,\"aiLeadScore\":{\"overall\":88,\"label\":\"Excellent Candidate\",\"summary\":\"Strong solar suitability, roof potential, and owner/contact signals based on live enrichment.\",\"breakdown\":{\"solarSuitability\":95,\"roofSize\":72,\"sunlightExposure\":77,\"propertyValue\":95,\"ownerOccupied\":50,\"contactAvailability\":96}}}', 'https://maps.googleapis.com/maps/api/staticmap?center=34.0765791%2C-118.40412780000001&zoom=20&size=640x360&maptype=satellite&scale=2&key=AIzaSyCBA9AhtIYZrLTKUJQ0SSgoTAIXgK8cnmg');

-- --------------------------------------------------------

--
-- Table structure for table `lead_activities`
--

CREATE TABLE `lead_activities` (
  `id` int(10) UNSIGNED NOT NULL,
  `lead_id` int(10) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED NOT NULL,
  `type` varchar(50) NOT NULL,
  `content` text DEFAULT NULL,
  `meta` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`meta`)),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `lead_activities`
--

INSERT INTO `lead_activities` (`id`, `lead_id`, `user_id`, `type`, `content`, `meta`, `created_at`) VALUES
(1, 61, 5, 'ai_call', 'The sales call was initiated by Emily from Solar Velocity, who attempted to engage the customer in a conversation about solar solutions. The customer seemed to have difficulty with language barriers and did not confirm if they were the homeowner. The call ended without a clear outcome.', '{\"callRecordId\":\"18\",\"disposition\":\"no_disposition\",\"sentiment\":\"neutral\"}', '2026-08-07 05:56:12'),
(2, 61, 5, 'ai_call', 'The sales call was initiated by Emily from Solar Velocity, who attempted to confirm if the customer was the homeowner. The conversation faced language barriers, with the customer switching between languages and eventually requesting to continue in English. The call did not progress beyond the initial introduction.', '{\"callRecordId\":\"18\",\"disposition\":\"no_disposition\",\"sentiment\":\"neutral\"}', '2026-08-07 05:56:13'),
(3, 63, 5, 'ai_call', 'Emily from Solar Velocity attempted to contact a potential customer to discuss solar savings opportunities. The customer was initially confused and questioned how their number was obtained, but Emily explained it was due to their property\'s potential for solar savings.', '{\"callRecordId\":\"20\",\"disposition\":\"callback\",\"sentiment\":\"neutral\"}', '2026-08-07 06:13:28'),
(4, 63, 5, 'ai_call', 'Emily from Solar Velocity attempted to contact a potential customer about solar savings opportunities. The customer was initially confused and questioned how their number was obtained. Emily offered to call back at a more convenient time.', '{\"callRecordId\":\"20\",\"disposition\":\"callback\",\"sentiment\":\"neutral\"}', '2026-08-07 06:13:28'),
(5, 64, 5, 'ai_call', 'The sales call was initiated by Emily from Solar Velocity, but the customer responded with an unclear statement and did not engage further.', '{\"callRecordId\":\"21\",\"disposition\":\"no_disposition\",\"sentiment\":\"neutral\"}', '2026-08-07 06:15:43'),
(6, 64, 5, 'ai_call', 'The sales call was initiated by Emily from Solar Velocity, but the customer did not engage in a meaningful conversation and ended the call abruptly.', '{\"callRecordId\":\"21\",\"disposition\":\"not_interested\",\"sentiment\":\"neutral\"}', '2026-08-07 06:15:43'),
(7, 65, 5, 'ai_call', 'The AI initiated a call and asked if the recipient had 30 seconds to chat, but the conversation ended with the AI asking for a better time to call back.', '{\"callRecordId\":\"22\",\"disposition\":\"callback\",\"sentiment\":\"neutral\",\"qaScore\":40}', '2026-08-07 07:36:59'),
(8, 65, 5, 'ai_call', 'The sales call was brief, with the AI asking if the recipient had 30 seconds to chat. The recipient did not engage further, and the AI asked for a better time to call back.', '{\"callRecordId\":\"22\",\"disposition\":\"callback\",\"sentiment\":\"neutral\",\"qaScore\":40}', '2026-08-07 07:37:00'),
(9, 65, 5, 'ai_call', 'The AI initiated a call, informing the recipient that the call may be recorded and asked if they had 30 seconds to chat. The AI then inquired about a suitable time for a quick call later in the day.', '{\"callRecordId\":\"22\",\"disposition\":\"callback\",\"sentiment\":\"neutral\",\"qaScore\":40}', '2026-08-07 07:37:00'),
(10, 66, 5, 'ai_call', 'Emily from Solar Velocity reached out to a potential lead, Personal Test Lead, to discuss solar energy solutions. The call was brief and focused on gauging interest in solar products.', '{\"callRecordId\":\"23\",\"disposition\":\"no_disposition\",\"sentiment\":\"neutral\",\"qaScore\":85}', '2026-08-07 07:40:13'),
(11, 66, 5, 'ai_call', 'Emily from Solar Velocity called to introduce their solar energy solutions. The lead was open to the conversation and expressed interest in learning more about potential savings and environmental benefits.', '{\"callRecordId\":\"23\",\"disposition\":\"qualified\",\"sentiment\":\"positive\",\"qaScore\":85}', '2026-08-07 07:40:15'),
(12, 66, 5, 'ai_call', 'Emily from Solar Velocity reached out to a potential lead, Personal Test Lead, to discuss solar energy solutions. The call was brief, and the lead was not available to engage further at the moment.', '{\"callRecordId\":\"23\",\"disposition\":\"callback\",\"sentiment\":\"neutral\",\"qaScore\":85}', '2026-08-07 07:40:24'),
(13, 67, 5, 'ai_call', 'Emily from Solar Velocity called a potential lead to discuss solar energy solutions. The lead was caught unexpectedly and did not have time to engage in a detailed conversation.', '{\"callRecordId\":\"24\",\"disposition\":\"callback\",\"sentiment\":\"neutral\",\"qaScore\":85}', '2026-08-07 07:43:29'),
(14, 67, 5, 'ai_call', 'Emily from Solar Velocity reached out to a potential lead to discuss solar energy solutions. The call was brief and primarily focused on confirming the lead\'s availability for a longer conversation.', '{\"callRecordId\":\"24\",\"disposition\":\"callback\",\"sentiment\":\"neutral\",\"qaScore\":85}', '2026-08-07 07:43:29'),
(15, 68, 5, 'ai_call', 'Emily from Solar Velocity called a potential lead to discuss solar savings opportunities. The customer confirmed they are the homeowner and expressed curiosity about how their number was obtained, but continued to engage in the conversation.', '{\"callRecordId\":\"25\",\"disposition\":\"qualified\",\"sentiment\":\"neutral\",\"qaScore\":60}', '2026-08-07 07:57:35'),
(16, 68, 5, 'ai_call', 'Emily from Solar Velocity called to discuss potential solar savings with the homeowner. The customer confirmed they are the homeowner and inquired about how their number was obtained and the company name.', '{\"callRecordId\":\"25\",\"disposition\":\"qualified\",\"sentiment\":\"neutral\",\"qaScore\":65}', '2026-08-07 07:57:36'),
(17, 68, 5, 'ai_call', 'Emily from Solar Velocity contacted a potential customer to discuss solar savings opportunities for their property. The customer confirmed they are the homeowner and inquired about the company\'s name before the call proceeded to discuss their monthly electric bill.', '{\"callRecordId\":\"25\",\"disposition\":\"qualified\",\"sentiment\":\"neutral\",\"qaScore\":60}', '2026-08-07 07:57:37'),
(18, 39, 5, 'note', 'dd', NULL, '2026-08-07 08:22:32');

-- --------------------------------------------------------

--
-- Table structure for table `marketing_inquiries`
--

CREATE TABLE `marketing_inquiries` (
  `id` int(10) UNSIGNED NOT NULL,
  `name` varchar(120) NOT NULL,
  `company` varchar(160) DEFAULT NULL,
  `email` varchar(190) NOT NULL,
  `phone` varchar(40) DEFAULT NULL,
  `country` varchar(80) DEFAULT NULL,
  `intent` varchar(40) NOT NULL DEFAULT 'demo',
  `message` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `outreach_messages`
--

CREATE TABLE `outreach_messages` (
  `id` int(10) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED NOT NULL,
  `lead_id` int(10) UNSIGNED NOT NULL,
  `channel` varchar(20) NOT NULL,
  `direction` varchar(20) NOT NULL DEFAULT 'outbound',
  `subject` varchar(255) DEFAULT NULL,
  `body` text DEFAULT NULL,
  `status` varchar(50) NOT NULL DEFAULT 'queued',
  `external_id` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `packages`
--

CREATE TABLE `packages` (
  `id` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `lead_limit` int(11) NOT NULL,
  `price` decimal(10,2) NOT NULL,
  `description` text DEFAULT NULL,
  `features` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `stripe_price_id` varchar(255) DEFAULT NULL,
  `razorpay_plan_id` varchar(255) DEFAULT NULL,
  `billing_interval` varchar(20) NOT NULL DEFAULT 'month',
  `is_subscription` tinyint(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `packages`
--

INSERT INTO `packages` (`id`, `name`, `lead_limit`, `price`, `description`, `features`, `created_at`, `updated_at`, `is_active`, `stripe_price_id`, `razorpay_plan_id`, `billing_interval`, `is_subscription`) VALUES
('custom', 'Custom Package', 250, '1999.00', 'Custom lead configuration for state-wide solar installation campaigns.', 'Unlimited Leads (Calculated),Custom Search Queries,Interactive Maps,Premium API Integration,Bulk Scanning,Dedicated Support', '2026-07-15 04:24:21', '2026-07-15 04:24:21', 1, NULL, NULL, 'month', 1),
('enterprise', 'Enterprise Package', 100, '999.00', 'Designed for high-performance solar companies scanning entire regions.', '100 Leads,ZIP/City/County Search,Full Rich API Integrations,Bulk Scanning,Satellite Intelligence,Dedicated Account Manager', '2026-07-15 04:24:21', '2026-07-15 04:24:21', 1, NULL, NULL, 'month', 1),
('Free', 'Free Trial', 5, '0.00', 'Signup free credits', '[\"5 free lead unlocks\"]', '2026-07-31 17:01:23', '2026-07-31 17:01:23', 0, NULL, NULL, 'month', 1),
('growth', 'Growth Package', 50, '599.00', 'Ideal for growing solar sales teams looking for steady territory coverage.', '50 Leads,ZIP & City Search,ATTOM Owner Enrichment,Mock Apollo Contacts,Satellite Intelligence,Priority Support', '2026-07-15 04:24:21', '2026-07-15 04:24:21', 1, NULL, NULL, 'month', 1),
('starter', 'Starter Package', 20, '299.00', 'Perfect for testing lead quality in small neighborhoods.', '20 Leads,ZIP Code Search,ATTOM Owner Enrichment,Mock Apollo Contacts,Standard Dashboard,Email Support', '2026-07-15 04:24:21', '2026-07-15 04:24:21', 1, NULL, NULL, 'month', 1);

-- --------------------------------------------------------

--
-- Table structure for table `proposals`
--

CREATE TABLE `proposals` (
  `id` int(10) UNSIGNED NOT NULL,
  `slug` varchar(64) NOT NULL,
  `lead_id` int(10) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED NOT NULL,
  `company_name` varchar(255) DEFAULT 'SollarX Energy Solutions',
  `system_size_kw` decimal(6,2) NOT NULL DEFAULT 8.50,
  `panel_count` int(11) NOT NULL DEFAULT 20,
  `gross_cost` decimal(10,2) NOT NULL DEFAULT 25500.00,
  `financing_type` enum('cash','loan','lease') NOT NULL DEFAULT 'cash',
  `loan_term_years` int(11) NOT NULL DEFAULT 20,
  `loan_interest_rate` decimal(4,2) NOT NULL DEFAULT 5.99,
  `down_payment` decimal(10,2) NOT NULL DEFAULT 0.00,
  `include_itc_30` tinyint(1) NOT NULL DEFAULT 1,
  `state_rebate` decimal(10,2) NOT NULL DEFAULT 1000.00,
  `battery_type` varchar(50) DEFAULT 'none',
  `battery_count` int(11) NOT NULL DEFAULT 0,
  `battery_cost` decimal(10,2) NOT NULL DEFAULT 0.00,
  `utility_escalation` decimal(4,2) NOT NULL DEFAULT 4.50,
  `est_25yr_savings` decimal(10,2) NOT NULL DEFAULT 38500.00,
  `payback_years` decimal(4,1) NOT NULL DEFAULT 6.2,
  `status` enum('draft','sent','viewed','signed','rejected') NOT NULL DEFAULT 'sent',
  `signed_name` varchar(255) DEFAULT NULL,
  `signed_email` varchar(255) DEFAULT NULL,
  `signed_signature_data` longtext DEFAULT NULL,
  `signed_at` datetime DEFAULT NULL,
  `viewed_at` datetime DEFAULT NULL,
  `view_count` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `proposals`
--

INSERT INTO `proposals` (`id`, `slug`, `lead_id`, `user_id`, `company_name`, `system_size_kw`, `panel_count`, `gross_cost`, `financing_type`, `loan_term_years`, `loan_interest_rate`, `down_payment`, `include_itc_30`, `state_rebate`, `battery_type`, `battery_count`, `battery_cost`, `utility_escalation`, `est_25yr_savings`, `payback_years`, `status`, `signed_name`, `signed_email`, `signed_signature_data`, `signed_at`, `viewed_at`, `view_count`, `created_at`, `updated_at`) VALUES
(1, 'prop_1786093629571_20e86ddc', 44, 6, 'SollarX Energy Solutions', '32.80', 82, '25500.00', 'cash', 20, '5.99', '0.00', 1, '1000.00', 'none', 0, '0.00', '4.50', '432366.00', '1.8', 'sent', NULL, NULL, NULL, NULL, NULL, 0, '2026-08-07 09:07:09', '2026-08-07 09:07:09');

-- --------------------------------------------------------

--
-- Table structure for table `scheduled_calls`
--

CREATE TABLE `scheduled_calls` (
  `id` int(10) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED NOT NULL,
  `lead_id` int(10) UNSIGNED NOT NULL,
  `scheduled_at` datetime NOT NULL,
  `script` text DEFAULT NULL,
  `status` varchar(50) NOT NULL DEFAULT 'scheduled',
  `summary` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `support_messages`
--

CREATE TABLE `support_messages` (
  `id` int(10) UNSIGNED NOT NULL,
  `ticket_id` int(10) UNSIGNED NOT NULL,
  `sender_id` int(10) UNSIGNED NOT NULL,
  `sender_role` varchar(20) NOT NULL,
  `body` text NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `support_tickets`
--

CREATE TABLE `support_tickets` (
  `id` int(10) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED NOT NULL,
  `subject` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `status` varchar(255) NOT NULL DEFAULT 'open',
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `support_tickets`
--

INSERT INTO `support_tickets` (`id`, `user_id`, `subject`, `message`, `status`, `created_at`) VALUES
(1, 2, 'Stripe Payment Receipt Request', 'Could you please send us the formal PDF receipt for our Growth Package purchase?', 'open', '2026-07-15 09:54:21');

-- --------------------------------------------------------

--
-- Table structure for table `team_members`
--

CREATE TABLE `team_members` (
  `id` int(10) UNSIGNED NOT NULL,
  `owner_user_id` int(10) UNSIGNED NOT NULL,
  `member_email` varchar(190) NOT NULL,
  `role` enum('manager','canvasser','sales_rep') NOT NULL DEFAULT 'sales_rep',
  `status` enum('pending','active') NOT NULL DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(10) UNSIGNED NOT NULL,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` varchar(255) NOT NULL DEFAULT 'solar_company',
  `company_name` varchar(255) DEFAULT NULL,
  `phone` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `account_status` varchar(50) NOT NULL DEFAULT 'active',
  `stripe_customer_id` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `name`, `email`, `password_hash`, `role`, `company_name`, `phone`, `created_at`, `updated_at`, `account_status`, `stripe_customer_id`) VALUES
(1, 'TechX Admin', 'admin@techxsolutions.com', '$2a$10$ORS/YjQbV2cOngU0bkcM.eGVoHX/91SXqTLvDnHP6F9KdXci5BOhm', 'super_admin', 'TechXSolutions', '1-800-555-0199', '2026-07-15 04:24:21', '2026-07-15 04:24:21', 'active', NULL),
(2, 'John Doe', 'company@solar.com', '$2a$10$yzqRjviG7bJnTgofQ34HT.VkPNk2rcKYXDyn3VBeIoea78uICO0eu', 'solar_company', 'Apex Solar Installers', '1-800-555-0122', '2026-07-15 04:24:21', '2026-07-15 04:24:21', 'active', NULL),
(3, 'Tier One', 'tier1_1785511330@test.local', '$2a$10$6gWw64hfkbdZVp3OpY6VDOJHhAHLsgeFuQ4mDaePAjTU6I9phX98m', 'admin', 'Test Co', NULL, '2026-07-31 15:22:10', '2026-07-31 15:22:10', 'active', NULL),
(4, 'Bulk Scan Smoke', 'bulkscan_smoke@example.com', '$2a$10$grIaOLEslNni.xN1PWQkg.G.FF5mJvN0Q9f4FqCY.6F4qIohSI3wy', 'solar_company', 'Smoke Co', NULL, '2026-07-31 15:58:36', '2026-07-31 15:58:36', 'active', NULL),
(5, 'Admin', 'admin@gmail.com', '$2a$10$nPNFSyx.9jZ22RL4cLSBQeAlfjjH23lMCyL6BYLUA1qa0tUsGuoyC', 'super_admin', 'Admin', NULL, '2026-08-02 07:25:58', '2026-08-02 07:25:58', 'active', NULL),
(6, 'rutvik', 'rutvik@gmail.com', '$2a$10$Q/qGA5zd7l8wTlYAlo/Rju6kOMOsr/yTe6.S8fZxpkdy218mzukHy', 'solar_company', 'rutvik', NULL, '2026-08-06 08:25:17', '2026-08-06 08:25:17', 'active', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `user_filter_presets`
--

CREATE TABLE `user_filter_presets` (
  `id` int(10) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED NOT NULL,
  `name` varchar(100) NOT NULL,
  `filters_json` text NOT NULL,
  `is_default` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `user_packages`
--

CREATE TABLE `user_packages` (
  `id` int(10) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED NOT NULL,
  `package_id` varchar(255) NOT NULL,
  `remaining_leads` int(11) NOT NULL DEFAULT 0,
  `purchased_leads` int(11) NOT NULL DEFAULT 0,
  `expires_at` datetime DEFAULT NULL,
  `status` varchar(255) NOT NULL DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `user_packages`
--

INSERT INTO `user_packages` (`id`, `user_id`, `package_id`, `remaining_leads`, `purchased_leads`, `expires_at`, `status`, `created_at`, `updated_at`) VALUES
(1, 2, 'growth', 9, 50, '2026-08-14 09:54:21', 'active', '2026-07-15 04:24:21', '2026-07-15 04:24:21'),
(2, 3, 'Starter', 67, 70, NULL, 'active', '2026-07-31 15:22:10', '2026-07-31 15:22:10'),
(4, 6, 'starter', 20, 20, NULL, 'active', '2026-08-06 08:25:17', '2026-08-06 08:25:17');

-- --------------------------------------------------------

--
-- Table structure for table `user_subscriptions`
--

CREATE TABLE `user_subscriptions` (
  `id` int(10) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED NOT NULL,
  `package_id` varchar(50) NOT NULL,
  `stripe_customer_id` varchar(255) DEFAULT NULL,
  `stripe_subscription_id` varchar(255) DEFAULT NULL,
  `status` varchar(50) NOT NULL DEFAULT 'active',
  `current_period_start` datetime DEFAULT NULL,
  `current_period_end` datetime DEFAULT NULL,
  `cancel_at_period_end` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `razorpay_subscription_id` varchar(255) DEFAULT NULL,
  `payment_provider` varchar(20) DEFAULT 'stripe'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `user_subscriptions`
--

INSERT INTO `user_subscriptions` (`id`, `user_id`, `package_id`, `stripe_customer_id`, `stripe_subscription_id`, `status`, `current_period_start`, `current_period_end`, `cancel_at_period_end`, `created_at`, `updated_at`, `razorpay_subscription_id`, `payment_provider`) VALUES
(1, 6, 'starter', 'dev_cus_6', 'dev_sub_6_1786091609808', 'active', '2026-08-07 14:03:29', '2026-09-07 14:03:29', 0, '2026-08-07 08:33:27', '2026-08-07 08:33:29', NULL, 'dev');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `admin_credit_adjustments`
--
ALTER TABLE `admin_credit_adjustments`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_credit_adj_user` (`user_id`),
  ADD KEY `idx_credit_adj_created` (`created_at`);

--
-- Indexes for table `ai_calling_appointments`
--
ALTER TABLE `ai_calling_appointments`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_aia_lead` (`lead_id`),
  ADD KEY `idx_aia_call` (`call_record_id`);

--
-- Indexes for table `ai_calling_audit_log`
--
ALTER TABLE `ai_calling_audit_log`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_acal_user_date` (`user_id`,`created_at`);

--
-- Indexes for table `ai_calling_campaigns`
--
ALTER TABLE `ai_calling_campaigns`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_ai_camp_user` (`user_id`),
  ADD KEY `idx_ai_camp_status` (`status`);

--
-- Indexes for table `ai_calling_queue`
--
ALTER TABLE `ai_calling_queue`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_campaign_lead` (`campaign_id`,`lead_id`),
  ADD KEY `idx_aiq_campaign` (`campaign_id`),
  ADD KEY `idx_aiq_status_next` (`status`,`next_attempt_at`),
  ADD KEY `idx_aiq_lead` (`lead_id`);

--
-- Indexes for table `ai_calling_settings`
--
ALTER TABLE `ai_calling_settings`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_acs_user` (`user_id`);

--
-- Indexes for table `ai_call_records`
--
ALTER TABLE `ai_call_records`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_acr_campaign` (`campaign_id`),
  ADD KEY `idx_acr_lead` (`lead_id`),
  ADD KEY `idx_acr_user_date` (`user_id`,`created_at`),
  ADD KEY `idx_acr_twilio` (`twilio_call_sid`);

--
-- Indexes for table `ai_knowledge_base`
--
ALTER TABLE `ai_knowledge_base`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_akb_user_cat` (`user_id`,`category`);

--
-- Indexes for table `ai_solar_agencies`
--
ALTER TABLE `ai_solar_agencies`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_asa_user` (`user_id`);

--
-- Indexes for table `ai_voicemail_templates`
--
ALTER TABLE `ai_voicemail_templates`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_avt_user` (`user_id`);

--
-- Indexes for table `api_logs`
--
ALTER TABLE `api_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `api_logs_user_id_foreign` (`user_id`);

--
-- Indexes for table `api_usage_daily`
--
ALTER TABLE `api_usage_daily`
  ADD PRIMARY KEY (`provider`,`usage_date`);

--
-- Indexes for table `appointments`
--
ALTER TABLE `appointments`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_appointments_user` (`user_id`),
  ADD KEY `idx_appointments_lead` (`lead_id`),
  ADD KEY `idx_appointments_when` (`scheduled_at`);

--
-- Indexes for table `bulk_scans`
--
ALTER TABLE `bulk_scans`
  ADD PRIMARY KEY (`id`),
  ADD KEY `bulk_scans_user_id_foreign` (`user_id`);

--
-- Indexes for table `drip_campaigns`
--
ALTER TABLE `drip_campaigns`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_drip_user` (`user_id`);

--
-- Indexes for table `drip_enrollments`
--
ALTER TABLE `drip_enrollments`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_campaign_lead` (`campaign_id`,`lead_id`),
  ADD KEY `idx_enroll_user_lead` (`user_id`,`lead_id`),
  ADD KEY `idx_enroll_status_next` (`status`,`next_run_at`);

--
-- Indexes for table `drip_steps`
--
ALTER TABLE `drip_steps`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_drip_steps_campaign` (`campaign_id`);

--
-- Indexes for table `drip_step_executions`
--
ALTER TABLE `drip_step_executions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_drip_exec_enrollment` (`enrollment_id`),
  ADD KEY `idx_drip_exec_lead` (`lead_id`),
  ADD KEY `idx_drip_exec_status` (`status`);

--
-- Indexes for table `drip_triggers`
--
ALTER TABLE `drip_triggers`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_drip_trigger_campaign` (`campaign_id`);

--
-- Indexes for table `invoices`
--
ALTER TABLE `invoices`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_invoices_user` (`user_id`),
  ADD KEY `idx_invoices_session` (`stripe_session_id`);

--
-- Indexes for table `knex_migrations`
--
ALTER TABLE `knex_migrations`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `knex_migrations_lock`
--
ALTER TABLE `knex_migrations_lock`
  ADD PRIMARY KEY (`index`);

--
-- Indexes for table `leads`
--
ALTER TABLE `leads`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_leads_user_status` (`user_id`,`status`),
  ADD KEY `idx_leads_user_created` (`user_id`,`created_at`);

--
-- Indexes for table `lead_activities`
--
ALTER TABLE `lead_activities`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_lead_activities_lead` (`lead_id`),
  ADD KEY `idx_lead_activities_user` (`user_id`);

--
-- Indexes for table `marketing_inquiries`
--
ALTER TABLE `marketing_inquiries`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_inquiries_created` (`created_at`),
  ADD KEY `idx_inquiries_email` (`email`);

--
-- Indexes for table `outreach_messages`
--
ALTER TABLE `outreach_messages`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_outreach_user` (`user_id`),
  ADD KEY `idx_outreach_lead` (`lead_id`);

--
-- Indexes for table `packages`
--
ALTER TABLE `packages`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `proposals`
--
ALTER TABLE `proposals`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `slug` (`slug`),
  ADD KEY `idx_prop_lead` (`lead_id`),
  ADD KEY `idx_prop_user` (`user_id`),
  ADD KEY `idx_prop_slug` (`slug`),
  ADD KEY `idx_prop_status` (`status`);

--
-- Indexes for table `scheduled_calls`
--
ALTER TABLE `scheduled_calls`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_calls_user` (`user_id`),
  ADD KEY `idx_calls_lead` (`lead_id`);

--
-- Indexes for table `support_messages`
--
ALTER TABLE `support_messages`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_messages_ticket` (`ticket_id`);

--
-- Indexes for table `support_tickets`
--
ALTER TABLE `support_tickets`
  ADD PRIMARY KEY (`id`),
  ADD KEY `support_tickets_user_id_foreign` (`user_id`);

--
-- Indexes for table `team_members`
--
ALTER TABLE `team_members`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_team_owner` (`owner_user_id`),
  ADD KEY `idx_team_email` (`member_email`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `users_email_unique` (`email`),
  ADD KEY `idx_users_email` (`email`);

--
-- Indexes for table `user_filter_presets`
--
ALTER TABLE `user_filter_presets`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_presets_user` (`user_id`);

--
-- Indexes for table `user_packages`
--
ALTER TABLE `user_packages`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_packages_package_id_foreign` (`package_id`),
  ADD KEY `idx_user_packages_user_status` (`user_id`,`status`);

--
-- Indexes for table `user_subscriptions`
--
ALTER TABLE `user_subscriptions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_user_subscription` (`user_id`),
  ADD KEY `idx_sub_stripe` (`stripe_subscription_id`),
  ADD KEY `idx_sub_status` (`status`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `admin_credit_adjustments`
--
ALTER TABLE `admin_credit_adjustments`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `ai_calling_appointments`
--
ALTER TABLE `ai_calling_appointments`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `ai_calling_audit_log`
--
ALTER TABLE `ai_calling_audit_log`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;

--
-- AUTO_INCREMENT for table `ai_calling_campaigns`
--
ALTER TABLE `ai_calling_campaigns`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `ai_calling_queue`
--
ALTER TABLE `ai_calling_queue`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `ai_calling_settings`
--
ALTER TABLE `ai_calling_settings`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `ai_call_records`
--
ALTER TABLE `ai_call_records`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=26;

--
-- AUTO_INCREMENT for table `ai_knowledge_base`
--
ALTER TABLE `ai_knowledge_base`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `ai_solar_agencies`
--
ALTER TABLE `ai_solar_agencies`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `ai_voicemail_templates`
--
ALTER TABLE `ai_voicemail_templates`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `api_logs`
--
ALTER TABLE `api_logs`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `appointments`
--
ALTER TABLE `appointments`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `bulk_scans`
--
ALTER TABLE `bulk_scans`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `drip_campaigns`
--
ALTER TABLE `drip_campaigns`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `drip_enrollments`
--
ALTER TABLE `drip_enrollments`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `drip_steps`
--
ALTER TABLE `drip_steps`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `drip_step_executions`
--
ALTER TABLE `drip_step_executions`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `drip_triggers`
--
ALTER TABLE `drip_triggers`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `invoices`
--
ALTER TABLE `invoices`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `knex_migrations`
--
ALTER TABLE `knex_migrations`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `knex_migrations_lock`
--
ALTER TABLE `knex_migrations_lock`
  MODIFY `index` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `leads`
--
ALTER TABLE `leads`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=70;

--
-- AUTO_INCREMENT for table `lead_activities`
--
ALTER TABLE `lead_activities`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=19;

--
-- AUTO_INCREMENT for table `marketing_inquiries`
--
ALTER TABLE `marketing_inquiries`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `outreach_messages`
--
ALTER TABLE `outreach_messages`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `proposals`
--
ALTER TABLE `proposals`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `scheduled_calls`
--
ALTER TABLE `scheduled_calls`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `support_messages`
--
ALTER TABLE `support_messages`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `support_tickets`
--
ALTER TABLE `support_tickets`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `team_members`
--
ALTER TABLE `team_members`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `user_filter_presets`
--
ALTER TABLE `user_filter_presets`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `user_packages`
--
ALTER TABLE `user_packages`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `user_subscriptions`
--
ALTER TABLE `user_subscriptions`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `api_logs`
--
ALTER TABLE `api_logs`
  ADD CONSTRAINT `api_logs_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `bulk_scans`
--
ALTER TABLE `bulk_scans`
  ADD CONSTRAINT `bulk_scans_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `leads`
--
ALTER TABLE `leads`
  ADD CONSTRAINT `leads_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `support_tickets`
--
ALTER TABLE `support_tickets`
  ADD CONSTRAINT `support_tickets_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `user_packages`
--
ALTER TABLE `user_packages`
  ADD CONSTRAINT `user_packages_package_id_foreign` FOREIGN KEY (`package_id`) REFERENCES `packages` (`id`),
  ADD CONSTRAINT `user_packages_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
