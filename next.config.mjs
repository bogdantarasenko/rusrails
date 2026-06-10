import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

const slugRedirects = {
  'action-cable-overview': 'action_cable_overview',
  'action-controller-overview': 'action_controller_overview',
  'action-mailbox-basics': 'action_mailbox_basics',
  'action-mailer-basics': 'action_mailer_basics',
  'action-text-overview': 'action_text_overview',
  'action-view-helpers': 'action_view_helpers',
  'action-view-overview': 'action_view_overview',
  'active-model-basics': 'active_model_basics',
  'active-record-associations': 'association_basics',
  'active-record-basics': 'active_record_basics',
  'active-record-callbacks': 'active_record_callbacks',
  'active-record-encryption': 'active_record_encryption',
  'active-record-migrations': 'active_record_migrations',
  'active-record-multiple-databases': 'active_record_multiple_databases',
  'active-record-postgresql': 'active_record_postgresql',
  'active-record-querying': 'active_record_querying',
  'active-record-validations': 'active_record_validations',
  'active-support-core-extensions': 'active_support_core_extensions',
  'active-support-instrumentation': 'active_support_instrumentation',
  'api-app': 'api_app',
  'asset-pipeline': 'asset_pipeline',
  'autoloading-and-reloading-constants': 'autoloading_and_reloading_constants',
  'caching-with-rails': 'caching_with_rails',
  'command-line': 'command_line',
  'debugging-rails-applications': 'debugging_rails_applications',
  'error-reporting': 'error_reporting',
  'form-helpers': 'form_helpers',
  'getting-started': 'getting_started',
  'layouts-and-rendering': 'layouts_and_rendering',
  'maintenance-policy': 'maintenance_policy',
  'rails-on-rack': 'rails_on_rack',
  'upgrading-ruby-on-rails': 'upgrading_ruby_on_rails',
  'working-with-javascript-in-rails': 'working_with_javascript_in_rails',
};

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  async redirects() {
    return Object.entries(slugRedirects).map(([from, to]) => ({
      source: `/docs/${from}`,
      destination: `/docs/${to}`,
      statusCode: 301,
    }));
  },
};

export default withMDX(config);
